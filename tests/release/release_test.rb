require 'minitest/autorun'
require 'fastlane'
require 'plist'
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
      'APPLE_WIDGET_PROVISIONING_PROFILE' => Base64.strict_encode64('fixture-widget-profile'),
      'VITE_SUPABASE_URL' => 'https://production.supabase.co',
      'VITE_SUPABASE_ANON_KEY' => 'header.' + Base64.urlsafe_encode64(JSON.generate({ role: 'anon', exp: Time.now.to_i + 3600 })) + '.signature'
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
    %w[APPLE_TEAM_ID APPLE_CERTIFICATE_P12 APPLE_CERTIFICATE_PASS VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY].each do |key|
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.reject { |name, _| name == key }) }
    end
    # Profile is optional when App Store Connect API keys are present (can be auto-provisioned)
    ReleaseConfig.build!(env.reject { |name, _| name == 'APPLE_PROVISIONING_PROFILE' })
    ['http://localhost', 'https://user:password@example.com', 'https://your-project.supabase.co', 'https://production.supabase.co/path'].each do |url|
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('VITE_SUPABASE_URL' => url)) }
    end
    assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('APPLE_CERTIFICATE_PASS' => 'wrong')) }
    assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('APPLE_PROVISIONING_PROFILE' => 'invalid-base64')) }
  end

  def test_client_build_never_accepts_privileged_expired_or_placeholder_keys
    env = signing_env
    ReleaseConfig.public_client_key!('sb_publishable_abcdefghijklmnop')
    ['sb_secret_abcdefghijklmnop', 'mock-key', 'service-role-key'].each do |key|
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('VITE_SUPABASE_ANON_KEY' => key)) }
    end
    [
      { role: 'service_role', exp: Time.now.to_i + 3600 },
      { role: 'anon', exp: Time.now.to_i - 1 },
      { role: 'anon' }
    ].each do |claims|
      key = 'header.' + Base64.urlsafe_encode64(JSON.generate(claims)) + '.signature'
      assert_raises(RuntimeError) { ReleaseConfig.build!(env.merge('VITE_SUPABASE_ANON_KEY' => key)) }
    end
  end

  def test_profile_requires_matching_app_team_and_distribution
    env = { 'APPLE_TEAM_ID' => 'ABCDEFGHIJ' }
    profile = {
      'UUID' => 'profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => {
        'application-identifier' => 'ABCDEFGHIJ.to.joli.app',
        'com.apple.developer.applesignin' => ['Default'],
        'get-task-allow' => false
      }
    }
    # Parse Apple's actual XML date representation instead of a Time-only mock.
    profile = Plist.parse_xml(Plist::Emit.dump(profile))
    assert_instance_of DateTime, profile.fetch('ExpirationDate')
    assert_equal 'profile-id', ReleaseConfig.profile!(profile, env)
    [
      profile.merge('TeamIdentifier' => ['OTHER']),
      profile.merge('ExpirationDate' => Time.now - 1),
      profile.merge('ProvisionedDevices' => ['device']),
      profile.merge('ProvisionsAllDevices' => true),
      profile.merge('Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.other', 'com.apple.developer.applesignin' => ['Default'], 'get-task-allow' => false }),
      profile.merge('Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app', 'get-task-allow' => false })
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
    UI = FastlaneCore::UI
    attr_reader :calls
    def initialize
      @lanes = {}
      @calls = []
      @current_platform = nil
      instance_eval(File.read(File.join(ReleaseConfig::ROOT, 'fastlane/Fastfile')), File.join(ReleaseConfig::ROOT, 'fastlane/Fastfile'))
    end
    def default_platform(*) = nil
    def platform(name)
      old = @current_platform
      @current_platform = name.to_sym
      yield
    ensure
      @current_platform = old
    end
    def desc(*) = nil
    def lane(name, &block)
      @lanes[[@current_platform, name.to_sym]] = block
      @lanes[name.to_sym] = block if @current_platform == :ios || @current_platform.nil?
    end
    alias private_lane lane
    def execute(name, options = {})
      lane_block = @lanes[[@current_platform, name.to_sym]] || @lanes[name.to_sym]
      raise "Lane #{name} not found" unless lane_block
      lane_block.call(options)
    end
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

  class SigningHarness < LaneHarness
    attr_accessor :failure
    attr_reader :keychain_path, :installed_profile

    def method_missing(name, **options)
      supported = %i[latest_testflight_build_number install_provisioning_profile create_keychain import_certificate update_code_signing_settings build_app upload_to_testflight delete_keychain]
      return super unless supported.include?(name)
      action = Fastlane::Actions.const_get(name.to_s.split('_').map(&:capitalize).join + 'Action')
      unknown = options.keys - action.available_options.map(&:key)
      raise "Unsupported #{name} options: #{unknown}" unless unknown.empty?
      calls << [name, options]
      raise 'simulated signing/upload failure' if name == failure
      case name
      when :latest_testflight_build_number then 41
      when :install_provisioning_profile
        @installed_profile = File.join(File.dirname(options.fetch(:path)), 'installed.mobileprovision')
        FileUtils.cp(options.fetch(:path), @installed_profile)
        @installed_profile
      when :create_keychain
        @keychain_path = options.fetch(:path)
        FileUtils.touch(@keychain_path)
      when :delete_keychain
        FileUtils.rm_f(options.fetch(:keychain_path))
      end
    end

    def respond_to_missing?(_name, _private = false) = true
  end

  def mock_signing_capture(app_uuid = 'profile-id', widget_uuid = 'widget-profile-id')
    app_profile_xml = Plist::Emit.dump({
      'UUID' => app_uuid, 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => {
        'application-identifier' => 'ABCDEFGHIJ.to.joli.app',
        'com.apple.developer.applesignin' => ['Default'],
        'get-task-allow' => false
      }
    })
    widget_profile_xml = Plist::Emit.dump({
      'UUID' => widget_uuid, 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app.JolitoWidgetExtension', 'get-task-allow' => false }
    })
    status = Struct.new(:success?).new(true)
    lambda do |*args|
      if args[1] == 'set-key-partition-list'
        ['', status]
      elsif args.any? { |a| a.to_s.include?('widget.mobileprovision') }
        [widget_profile_xml, status]
      else
        [app_profile_xml, status]
      end
    end
  end

  def test_signing_and_upload_failures_always_remove_credentials_and_never_submit
    Fastlane::Actions.load_default_actions
    env = signing_env
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    capture_proc = mock_signing_capture
    %i[import_certificate build_app upload_to_testflight].each do |failure|
      harness = SigningHarness.new
      harness.failure = failure
      Open3.stub(:capture2, capture_proc) do
        error = assert_raises(RuntimeError) { harness.execute(:beta) }
        assert_equal 'simulated signing/upload failure', error.message
      end
      refute File.exist?(harness.keychain_path)
      refute File.exist?(harness.installed_profile)
      assert_equal :delete_keychain, harness.calls.last.first
      refute harness.calls.any? { |name, _| name == :upload_to_app_store }
    end
  ensure
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_configures_default_keychain_partition_and_explicit_apple_distribution_identity
    Fastlane::Actions.load_default_actions
    env = signing_env
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    captured_commands = []
    base_proc = mock_signing_capture
    capture_proc = lambda do |*args|
      captured_commands << args
      base_proc.call(*args)
    end
    harness = SigningHarness.new
    Open3.stub(:capture2, capture_proc) do
      harness.execute(:beta)
    end
    keychain_call = harness.calls.find { |name, _| name == :create_keychain }
    assert keychain_call, 'Expected create_keychain call'
    assert_equal true, keychain_call[1][:default_keychain], 'create_keychain must set default_keychain: true for xcodebuild'

    partition_call = captured_commands.find { |args| args[0] == 'security' && args[1] == 'set-key-partition-list' }
    assert partition_call, 'Expected security set-key-partition-list to be invoked'
    assert_equal ['security', 'set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k'], partition_call[0..5]
    assert_equal harness.keychain_path, partition_call[7]

    build_call = harness.calls.find { |name, _| name == :build_app }
    assert build_call, 'Expected build_app call'
    xcargs = build_call[1][:xcargs]
    assert_includes xcargs, 'CODE_SIGN_IDENTITY="Apple Distribution"'
    refute_includes xcargs, 'PROVISIONING_PROFILE_SPECIFIER'

    app_signing = harness.calls.find { |name, opts| name == :update_code_signing_settings && opts[:targets] == ['App'] }
    assert app_signing, 'Expected update_code_signing_settings for App'
    assert_equal 'profile-id', app_signing[1][:profile_uuid]
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_supports_widget_extension_signing_when_profile_provided
    Fastlane::Actions.load_default_actions
    env = signing_env.merge('APPLE_WIDGET_PROVISIONING_PROFILE' => Base64.strict_encode64('widget-profile-content'))
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    capture_proc = mock_signing_capture('app-profile-id', 'widget-profile-id')
    harness = SigningHarness.new
    Open3.stub(:capture2, capture_proc) do
      harness.execute(:beta)
    end
    widget_signing = harness.calls.find { |name, opts| name == :update_code_signing_settings && opts[:targets] == ['JolitoWidgetExtension'] }
    assert widget_signing, 'Expected update_code_signing_settings for JolitoWidgetExtension'
    assert_equal 'widget-profile-id', widget_signing[1][:profile_uuid]

    build_call = harness.calls.find { |name, _| name == :build_app }
    assert_equal 'app-profile-id', build_call[1][:export_options][:provisioningProfiles]['to.joli.app']
    assert_equal 'widget-profile-id', build_call[1][:export_options][:provisioningProfiles]['to.joli.app.JolitoWidgetExtension']
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_auto_provisions_widget_extension_when_profile_not_provided
    Fastlane::Actions.load_default_actions
    env = signing_env
    env.delete('APPLE_WIDGET_PROVISIONING_PROFILE')
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    status = Struct.new(:success?).new(true)
    base_proc = mock_signing_capture('app-profile-id', 'auto-widget-profile-id')
    node_command_args = nil
    capture2e_proc = lambda do |*args|
      if args[0] == 'node' && args.any? { |arg| arg.to_s.include?('provision-widget.ts') }
        node_command_args = args
        output_idx = args.index('--output')
        if output_idx && args[output_idx + 1]
          File.binwrite(args[output_idx + 1], 'simulated-widget-profile-content')
        end
        ['Auto-provisioned widget profile', status]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2e, capture2e_proc) do
      Open3.stub(:capture2, base_proc) do
        harness.execute(:beta)
      end
    end
    assert node_command_args, 'Expected provision-widget.ts to be invoked via node'
    assert_includes node_command_args, '--output'

    widget_signing = harness.calls.find { |name, opts| name == :update_code_signing_settings && opts[:targets] == ['JolitoWidgetExtension'] }
    assert widget_signing, 'Expected update_code_signing_settings for JolitoWidgetExtension'
    assert_equal 'auto-widget-profile-id', widget_signing[1][:profile_uuid]

    build_call = harness.calls.find { |name, _| name == :build_app }
    assert_equal 'auto-widget-profile-id', build_call[1][:export_options][:provisioningProfiles]['to.joli.app.JolitoWidgetExtension']
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_fails_fast_when_widget_profile_unresolved
    Fastlane::Actions.load_default_actions
    env = signing_env
    env.delete('APPLE_WIDGET_PROVISIONING_PROFILE')
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    failure_status = Struct.new(:success?).new(false)
    base_proc = mock_signing_capture
    capture2e_proc = lambda do |*args|
      if args[0] == 'node' && args.any? { |arg| arg.to_s.include?('provision-widget.ts') }
        ['Auto-provisioning failed: 403 Forbidden', failure_status]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2e, capture2e_proc) do
      Open3.stub(:capture2, base_proc) do
        error = assert_raises(StandardError) { harness.execute(:beta) }
        assert_includes error.message, 'Failed to auto-provision widget extension profile'
      end
    end
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_fails_fast_when_widget_uuid_cannot_be_resolved
    Fastlane::Actions.load_default_actions
    env = signing_env
    env.delete('APPLE_WIDGET_PROVISIONING_PROFILE')
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    success_status = Struct.new(:success?).new(true)
    base_proc = mock_signing_capture
    capture2e_proc = lambda do |*args|
      if args[0] == 'node' && args.any? { |arg| arg.to_s.include?('provision-widget.ts') }
        ['Finished without writing output', success_status]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2e, capture2e_proc) do
      Open3.stub(:capture2, base_proc) do
        error = assert_raises(StandardError) { harness.execute(:beta) }
        assert_includes error.message, 'JolitoWidgetExtension provisioning profile could not be resolved'
      end
    end
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_auto_provisions_app_profile_when_applesignin_missing
    Fastlane::Actions.load_default_actions
    env = signing_env
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    status = Struct.new(:success?).new(true)
    old_app_profile_xml = Plist::Emit.dump({
      'UUID' => 'old-app-profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app', 'get-task-allow' => false }
    })
    new_app_profile_xml = Plist::Emit.dump({
      'UUID' => 'auto-app-profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => {
        'application-identifier' => 'ABCDEFGHIJ.to.joli.app',
        'com.apple.developer.applesignin' => ['Default'],
        'get-task-allow' => false
      }
    })
    widget_profile_xml = Plist::Emit.dump({
      'UUID' => 'widget-profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app.JolitoWidgetExtension', 'get-task-allow' => false }
    })
    provision_called = false
    base_proc = lambda do |*args|
      if args[1] == 'set-key-partition-list'
        ['', status]
      elsif args.any? { |a| a.to_s.include?('widget.mobileprovision') }
        [widget_profile_xml, status]
      elsif provision_called
        [new_app_profile_xml, status]
      else
        [old_app_profile_xml, status]
      end
    end
    node_command_args = nil
    capture2e_proc = lambda do |*args|
      if args[0] == 'node' && args.any? { |arg| arg.to_s.include?('provision-app.ts') }
        node_command_args = args
        provision_called = true
        output_idx = args.index('--output')
        if output_idx && args[output_idx + 1]
          File.binwrite(args[output_idx + 1], 'simulated-app-profile-content')
        end
        ['Auto-provisioned app profile', status]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2e, capture2e_proc) do
      Open3.stub(:capture2, base_proc) do
        harness.execute(:beta)
      end
    end
    assert node_command_args, 'Expected provision-app.ts to be invoked via node'
    assert_includes node_command_args, '--output'

    app_signing = harness.calls.find { |name, opts| name == :update_code_signing_settings && opts[:targets] == ['App'] }
    assert app_signing, 'Expected update_code_signing_settings for App'
    assert_equal 'auto-app-profile-id', app_signing[1][:profile_uuid]

    build_call = harness.calls.find { |name, _| name == :build_app }
    assert_equal 'auto-app-profile-id', build_call[1][:export_options][:provisioningProfiles]['to.joli.app']
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_fails_fast_when_app_provisioning_fails
    Fastlane::Actions.load_default_actions
    env = signing_env
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    failure_status = Struct.new(:success?).new(false)
    old_app_profile_xml = Plist::Emit.dump({
      'UUID' => 'old-app-profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app', 'get-task-allow' => false }
    })
    base_proc = lambda do |*args|
      if args[1] == 'set-key-partition-list'
        ['', failure_status]
      else
        [old_app_profile_xml, Struct.new(:success?).new(true)]
      end
    end
    capture2e_proc = lambda do |*args|
      if args[0] == 'node' && args.any? { |arg| arg.to_s.include?('provision-app.ts') }
        ['Auto-provisioning failed: 403 Forbidden', failure_status]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2e, capture2e_proc) do
      Open3.stub(:capture2, base_proc) do
        error = assert_raises(StandardError) { harness.execute(:beta) }
        assert_includes error.message, 'Failed to auto-provision app profile'
      end
    end
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_beta_lane_fails_fast_when_app_profile_unentitled_and_no_api_key
    Fastlane::Actions.load_default_actions
    env = signing_env
    env.delete('APP_STORE_CONNECT_API_KEY_KEY')
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    old_app_profile_xml = Plist::Emit.dump({
      'UUID' => 'old-app-profile-id', 'TeamIdentifier' => ['ABCDEFGHIJ'],
      'ExpirationDate' => Time.now + 3600,
      'Entitlements' => { 'application-identifier' => 'ABCDEFGHIJ.to.joli.app', 'get-task-allow' => false }
    })
    base_proc = lambda do |*args|
      [old_app_profile_xml, Struct.new(:success?).new(true)]
    end
    harness = SigningHarness.new
    ReleaseConfig.stub(:build!, nil) do
      harness.stub(:connect, nil) do
        Open3.stub(:capture2, base_proc) do
          error = assert_raises(StandardError) { harness.execute(:beta) }
          assert_includes error.message, 'lacks Sign In with Apple capability'
        end
      end
    end
  ensure
    FileUtils.rm_rf(File.join(ReleaseConfig::ROOT, 'build'))
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_partition_list_failure_raises_error_and_cleans_up_keychain
    Fastlane::Actions.load_default_actions
    env = signing_env
    previous = env.keys.to_h { |key| [key, ENV[key]] }
    ENV.update(env)
    failure = Struct.new(:success?).new(false)
    base_proc = mock_signing_capture
    capture_proc = lambda do |*args|
      if args[1] == 'set-key-partition-list'
        ['', failure]
      else
        base_proc.call(*args)
      end
    end
    harness = SigningHarness.new
    Open3.stub(:capture2, capture_proc) do
      error = assert_raises(StandardError) { harness.execute(:beta) }
      assert_includes error.message, 'Cannot set keychain partition list'
    end
    refute File.exist?(harness.keychain_path)
    refute File.exist?(harness.installed_profile)
    assert_equal :delete_keychain, harness.calls.last.first
  ensure
    previous&.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
  end

  def test_submission_delegates_to_app_store_submit_with_exact_build_number
    Fastlane::Actions.load_default_actions
    harness = LaneHarness.new
    captured = []
    capture_proc = lambda do |*args|
      captured << args
      ['submitted', Struct.new(:success?).new(true)]
    end
    Open3.stub(:capture2e, capture_proc) do
      harness.execute(:release, build_number: '42')
    end
    assert_equal [:connect], harness.calls.map(&:first)
    assert_equal 1, captured.length
    assert_equal 'node', captured[0][0]
    assert_includes captured[0][1], 'scripts/app-store.ts'
    assert_equal '--submit', captured[0][2]
    assert_equal '42', captured[0][3]
  end

  def test_submission_rejects_invalid_build_numbers
    Fastlane::Actions.load_default_actions
    harness = LaneHarness.new
    assert_raises(StandardError) { harness.execute(:release, build_number: '') }
    assert_raises(StandardError) { harness.execute(:release, build_number: 'invalid') }
  end

  def test_metadata_lane_validates_native_screenshots_and_uses_deliver_options
    Fastlane::Actions.load_default_actions
    harness = LaneHarness.new
    ReleaseConfig.stub(:review_package!, { demo_user: 'review@example.com', demo_password: 'private-inbox-password' }) do
      harness.execute(:metadata)
    end
    assert_equal [:connect, :upload_to_app_store], harness.calls.map(&:first)
    options = harness.calls.last.last
    assert_equal 'to.joli.app', options.fetch(:app_identifier)
    assert_equal '1.0', options.fetch(:app_version)
    assert_equal File.join(ReleaseConfig::ROOT, 'fastlane/native-screenshots'), options.fetch(:screenshots_path)
    assert_equal File.join(ReleaseConfig::ROOT, 'fastlane/metadata'), options.fetch(:metadata_path)
    assert_equal({ demo_user: 'review@example.com', demo_password: 'private-inbox-password' }, options.fetch(:app_review_information))
    assert_equal File.join(ReleaseConfig::ROOT, 'docs/media/native-walkthrough.mp4'), options.fetch(:app_review_attachment_file)
    assert options.fetch(:skip_binary_upload)
    refute options.fetch(:submit_for_review)
  end

  def test_review_upload_requires_independent_account_credentials
    env = { 'APP_REVIEW_EMAIL' => 'review@example.com', 'APP_REVIEW_MAILBOX_PASSWORD' => 'private-inbox-password' }
    assert_equal({ demo_user: 'review@example.com', demo_password: 'private-inbox-password' }, ReleaseConfig.review_account!(env))
    env.keys.each do |key|
      error = assert_raises(RuntimeError) { ReleaseConfig.review_account!(env.reject { |name, _| name == key }) }
      refute_includes error.message, 'private-inbox-password'
      assert_raises(RuntimeError) { ReleaseConfig.review_account!(env.merge(key => ' ')) }
    end
    assert_raises(RuntimeError) { ReleaseConfig.review_account!(env.merge('APP_REVIEW_EMAIL' => 'not-email')) }
    harness = LaneHarness.new
    ReleaseConfig.stub(:review_package!, -> { raise 'Missing reviewer credentials' }) do
      assert_raises(RuntimeError) { harness.execute(:metadata) }
    end
    assert_empty harness.calls, 'Missing credentials must fail before contacting Apple'
  end

  def test_review_package_preflight_rejects_incomplete_or_changed_evidence_before_connecting
    env = { 'APP_REVIEW_EMAIL' => 'review@example.com', 'APP_REVIEW_MAILBOX_PASSWORD' => 'private-inbox-password' }
    Dir.mktmpdir do |root|
      notes = File.join(root, 'fastlane/metadata/review_information/notes.txt')
      movie = File.join(root, 'docs/media/native-walkthrough.mp4')
      manifest = File.join(root, 'docs/media/native-walkthrough.json')
      FileUtils.mkdir_p(File.dirname(notes))
      FileUtils.mkdir_p(File.dirname(movie))
      files = { notes => 'Complete review notes', movie => "0000ftypisom_movie_bytes" }
      files[manifest] = JSON.generate({ sha256: Digest::SHA256.hexdigest(files.fetch(movie)) })
      restore = -> { files.each { |path, bytes| File.binwrite(path, bytes) } }
      restore.call
      assert_equal ReleaseConfig.review_account!(env), ReleaseConfig.review_package!(env, root)
      cases = files.keys.map { |path| -> { File.unlink(path) } } + [
        -> { File.write(notes, ' ') },
        -> { File.write(notes, 'x' * 4001) },
        -> { File.write(movie, 'not a movie') },
        -> { File.write(movie, files.fetch(movie) + 'changed') },
        -> { File.write(manifest, '{}') },
        -> { File.write(manifest, 'invalid json') },
      ]
      cases.each do |invalidate|
        restore.call
        invalidate.call
        preflight = ReleaseConfig.method(:review_package!)
        harness = LaneHarness.new
        ReleaseConfig.stub(:review_package!, -> { preflight.call(env, root) }) do
          assert_raises(RuntimeError) { harness.execute(:metadata) }
        end
        assert_empty harness.calls, 'Invalid evidence must fail before contacting Apple'
      end
      restore.call
      env.keys.each { |key| assert_raises(RuntimeError) { ReleaseConfig.review_package!(env.reject { |name, _| name == key }, root) } }
    end
    workflow = File.read(File.join(ReleaseConfig::ROOT, '.github/workflows/appstore.yml'))
    assert_operator workflow.index('release_config.rb review'), :<, workflow.index('app-store.ts --withdraw')
  end

  def test_review_information_metadata_satisfies_app_store_connect_contract
    review_dir = File.join(ReleaseConfig::ROOT, 'fastlane/metadata/review_information')
    assert Dir.exist?(review_dir), 'Expected fastlane/metadata/review_information directory to exist'
    %w[first_name last_name phone_number email_address notes].each do |field|
      file = File.join(review_dir, "#{field}.txt")
      assert File.file?(file), "Expected #{field}.txt to exist in #{review_dir}"
      content = File.read(file).strip
      refute_empty content, "#{field}.txt must not be empty"
      case field
      when 'phone_number'
        assert_match(/\A\+[0-9]/, content, 'Phone number must start with + and country code')
      when 'email_address'
        assert_match(/\A[^@\s]+@[^@\s]+\.[^@\s]+\z/, content, 'Email address must be a valid email format')
      end
    end
    # Credentials are required at upload time and must never be committed.
    refute File.exist?(File.join(review_dir, 'demo_user.txt')), 'Private credentials must not use demo_user.txt'
    refute File.exist?(File.join(review_dir, 'demo_password.txt')), 'Private credentials must not use demo_password.txt'
  end

  def test_invalid_submission_never_contacts_apple
    harness = LaneHarness.new
    assert_raises(RuntimeError) { harness.execute(:release) }
    assert_empty harness.calls
  end
end
