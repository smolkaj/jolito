require 'base64'
require 'json'
require 'openssl'
require 'uri'

# No credentials are interpolated into validation errors or shell commands.
module ReleaseConfig
  ROOT = File.expand_path('..', __dir__)
  SETTINGS = JSON.parse(File.read(File.join(__dir__, 'release.json'))).freeze

  def self.required!(env, names)
    missing = names.select { |name| env[name].to_s.strip.empty? }
    raise "Missing release configuration: #{missing.join(', ')}" unless missing.empty?
  end

  def self.api!(env = ENV)
    required!(env, %w[APP_STORE_CONNECT_API_KEY_KEY_ID APP_STORE_CONNECT_API_KEY_ISSUER_ID APP_STORE_CONNECT_API_KEY_KEY])
    key = OpenSSL::PKey.read(Base64.strict_decode64(env.fetch('APP_STORE_CONNECT_API_KEY_KEY')))
    raise 'App Store Connect requires a private EC key' unless key.is_a?(OpenSSL::PKey::EC) && key.private?
  rescue ArgumentError, OpenSSL::PKey::PKeyError
    raise 'APP_STORE_CONNECT_API_KEY_KEY must contain a base64-encoded .p8 private key'
  end

  def self.build!(env = ENV)
    api!(env)
    required!(env, %w[APPLE_TEAM_ID APPLE_CERTIFICATE_P12 APPLE_CERTIFICATE_PASS APPLE_PROVISIONING_PROFILE VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY])
    raise 'APPLE_TEAM_ID must be a 10-character team ID' unless env.fetch('APPLE_TEAM_ID').match?(/\A[A-Z0-9]{10}\z/)
    url = URI.parse(env.fetch('VITE_SUPABASE_URL'))
    raise 'VITE_SUPABASE_URL must be a production HTTPS origin' unless url.scheme == 'https' && url.host && !url.host.include?('your-project') && !url.userinfo && ['', '/'].include?(url.path) && !url.query && !url.fragment
    cert = OpenSSL::PKCS12.new(Base64.strict_decode64(env.fetch('APPLE_CERTIFICATE_P12')), env.fetch('APPLE_CERTIFICATE_PASS'))
    raise 'Distribution certificate must include its private key and be unexpired' unless cert.key && cert.certificate && cert.certificate.not_after > Time.now
    Base64.strict_decode64(env.fetch('APPLE_PROVISIONING_PROFILE'))
  rescue URI::InvalidURIError, ArgumentError, OpenSSL::PKCS12::PKCS12Error
    raise 'Invalid release URL, base64 signing data, or certificate password'
  end

  def self.build_number!(value)
    raise 'Specify the exact tested build number (1–9999)' unless value.to_s.match?(/\A[1-9]\d{0,3}\z/)
    value.to_s
  end

  def self.profile!(profile, env = ENV)
    expected = "#{env.fetch('APPLE_TEAM_ID')}.#{SETTINGS.fetch('bundleId')}"
    raise 'Provisioning profile does not match the app/team' unless profile.dig('Entitlements', 'application-identifier') == expected && profile.fetch('TeamIdentifier').include?(env.fetch('APPLE_TEAM_ID'))
    raise 'An unexpired App Store distribution profile is required' unless profile.fetch('ExpirationDate') > Time.now && !profile['ProvisionedDevices'] && !profile['ProvisionsAllDevices'] && profile.dig('Entitlements', 'get-task-allow') == false
    profile.fetch('UUID')
  end
end

if $PROGRAM_NAME == __FILE__
  case ARGV.fetch(0, '')
  when 'build' then ReleaseConfig.build!
  when 'api' then ReleaseConfig.api!
  else abort 'Usage: ruby fastlane/release_config.rb build|api'
  end
  puts 'Release configuration validated.'
end
