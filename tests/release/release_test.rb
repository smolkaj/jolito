require 'minitest/autorun'
require 'fastlane'
require_relative '../../fastlane/release_config'

class ReleaseTest < Minitest::Test
  def api_env
    {
      'APP_STORE_CONNECT_API_KEY_KEY_ID' => 'KEYID',
      'APP_STORE_CONNECT_API_KEY_ISSUER_ID' => 'issuer',
      'APP_STORE_CONNECT_API_KEY_KEY' => Base64.strict_encode64(OpenSSL::PKey::EC.generate('prime256v1').to_pem)
    }
  end

  def test_missing_credentials_fail_without_exposing_values
    error = assert_raises(RuntimeError) { ReleaseConfig.build!({ 'APPLE_CERTIFICATE_PASS' => 'secret-value' }) }
    assert_includes error.message, 'APP_STORE_CONNECT_API_KEY_KEY_ID'
    refute_includes error.message, 'secret-value'
    env = api_env
    env.keys.each do |key|
      assert_raises(RuntimeError) { ReleaseConfig.api!(env.reject { |name, _| name == key }) }
    end
  end

  def test_signing_preflight_requires_all_production_inputs
    env = api_env
    assert_raises(RuntimeError) { ReleaseConfig.build!(env) }
    env['APP_STORE_CONNECT_API_KEY_KEY'] = Base64.strict_encode64('not a private key')
    assert_raises(RuntimeError) { ReleaseConfig.api!(env) }
  end

  def signing_env
    env = api_env.merge({
      'APPLE_TEAM_ID' => 'ABCDEFGHIJ', 'APPLE_CERTIFICATE_PASS' => 'fixture-password',
      'APPLE_PROVISIONING_PROFILE' => Base64.strict_encode64('fixture-profile'),
      'VITE_SUPABASE_URL' => 'https://production.supabase.co',
      'VITE_SUPABASE_ANON_KEY' => 'public-client-key'
    })
    key = OpenSSL::PKey::RSA.new(2048)
    cert = OpenSSL::X509::Certificate.new
    cert.version = 2
    cert.serial = 1
    cert.subject = cert.issuer = OpenSSL::X509::Name.parse('/CN=Apple Distribution: Fixture')
    cert.public_key = key.public_key
    cert.not_before = Time.now - 60
    cert.not_after = Time.now + 3600
    cert.sign(key, OpenSSL::Digest.new('SHA256'))
    env['APPLE_CERTIFICATE_P12'] = Base64.strict_encode64(OpenSSL::PKCS12.create(env['APPLE_CERTIFICATE_PASS'], 'test', key, cert).to_der)
    env
  end

  def test_complete_signing_configuration_and_each_missing_field
    env = signing_env
    ReleaseConfig.build!(env)
    %w[APPLE_TEAM_ID APPLE_CERTIFICATE_P12 APPLE_CERTIFICATE_PASS APPLE_PROVISIONING_PROFILE VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY].each do |key|
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.reject { |name, _| name == key }) }
    end
    ['http://localhost', 'https://user:password@example.com', 'https://your-project.supabase.co', 'https://production.supabase.co/path'].each do |url|
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('VITE_SUPABASE_URL' => url)) }
    end
    assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('APPLE_CERTIFICATE_PASS' => 'wrong')) }
    assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('APPLE_PROVISIONING_PROFILE' => 'invalid-base64')) }
  end

  def test_profile_requires_matching_app_team_and_distribution
    env = { 'APPLE_TEAM_ID' => 'ABCDEFGHIJ' }
    profile = {
      'UUID' => 'profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app', 'get-task-allow' => false }
    }
    assert_equal 'profile-id', ReleaseConfig.profile!(profile, env)
    [
      profile.merge('TeamIdentifier' => ['OTHER']),
      profile.merge('ExpirationDate' => Time.now - 1),
      profile.merge('ProvisionedDevices' => ['device']),
      profile.merge('ProvisionsAllDevices' => true),
      profile.merge('Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.other', 'get-task-allow' => false })
    ].each { |invalid| assert_raises(RuntimeError) { ReleaseConfig.profile!(invalid, env) } }
  end

  def test_build_numbers_cannot_be_latest_empty_or_shell_input
    [nil, '', 'latest', '0', '-1', '1;whoami', '1\n', '10000'].each do |value|
      assert_raises(RuntimeError) { ReleaseConfig.build_number!(value) }
    end
    assert_equal '42', ReleaseConfig.build_number!(42)
  end

  # Execute the actual lane orchestration while replacing Apple's side effects.
  class LaneHarness
    attr_reader :calls
    def initialize
      @lanes = {}
      @calls = []
      instance_eval(File.read(File.join(ReleaseConfig::ROOT, 'fastlane/Fastfile')), File.join(ReleaseConfig::ROOT, 'fastlane/Fastfile'))
    end
    def default_platform(*) = nil
    def platform(*) = yield
    def desc(*) = nil
    def lane(name, &block) = @lanes[name] = block
    alias private_lane lane
    def execute(name, options = {}) = @lanes.fetch(name).call(options)
    def connect = @calls << [:connect, {}]
    def upload_to_app_store(options)
      # Validate against the installed Fastlane action, catching obsolete options
      # before a release ever needs secrets or an Apple account.
      known = Fastlane::Actions::UploadToAppStoreAction.available_options.map(&:key)
      unknown = options.keys - known
      raise "Unsupported deliver options: #{unknown}" unless unknown.empty?
      @calls << [:upload_to_app_store, options]
    end
  end

  def test_submission_selects_exact_build_and_never_builds_or_uploads_binary
    Fastlane::Actions.load_default_actions
    harness = LaneHarness.new
    harness.execute(:release, build_number: '42')
    assert_equal [:connect, :upload_to_app_store], harness.calls.map(&:first)
    options = harness.calls.last.last
    assert_equal '42', options.fetch(:build_number)
    assert_equal '1.0', options.fetch(:app_version)
    assert options.fetch(:skip_binary_upload)
    assert options.fetch(:submit_for_review)
    assert options.fetch(:automatic_release)
  end

  def test_invalid_submission_never_contacts_apple
    harness = LaneHarness.new
    assert_raises(RuntimeError) { harness.execute(:release) }
    assert_empty harness.calls
  end
end
