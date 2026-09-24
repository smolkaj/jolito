require 'xcodeproj'

# Generate the test harness in CI; the application target stays canonical.
root = File.expand_path('..', __dir__)
name = ARGV.fetch(0, 'NativeScreenshots')
raise 'Unknown capture harness' unless %w[NativeScreenshots NativeWalkthrough].include?(name)
project = Xcodeproj::Project.open(File.join(root, 'ios/App/App.xcodeproj'))
app = project.targets.find { |target| target.name == 'App' }
raise 'App target missing' unless app
raise 'Capture target already exists' if project.targets.any? { |target| target.name == name }
target = project.new_target(:ui_test_bundle, name, :ios, '15.0')
target.add_dependency(app)
source = project.main_group.new_file(File.join(root, "scripts/#{name}.swift"))
target.source_build_phase.add_file_reference(source)
target.build_configurations.each do |config|
  config.build_settings.merge!({
    'GENERATE_INFOPLIST_FILE' => 'YES', 'SWIFT_VERSION' => '5.0',
    'PRODUCT_NAME' => '$(TARGET_NAME)',
    'PRODUCT_BUNDLE_IDENTIFIER' => 'to.joli.app.screenshots',
    'TEST_TARGET_NAME' => 'App', 'CODE_SIGNING_ALLOWED' => 'NO',
    'TARGETED_DEVICE_FAMILY' => '1,2'
  })
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(target)
scheme.add_test_target(target)
scheme.set_launch_target(app)
if name == 'NativeWalkthrough'
  scheme.test_action.should_use_launch_scheme_args_env = false
  scheme.test_action.environment_variables = Xcodeproj::XCScheme::EnvironmentVariables.new([
    { key: 'WALKTHROUGH_EMAIL', value: ENV.fetch('APP_REVIEW_EMAIL') },
    { key: 'WALKTHROUGH_MAILBOX_PASSWORD', value: ENV.fetch('APP_REVIEW_MAILBOX_PASSWORD') }
  ])
end
scheme.save_as(project.path, name, true)
