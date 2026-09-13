require 'xcodeproj'

# Generate the test harness in CI; the application target stays canonical.
root = File.expand_path('..', __dir__)
project = Xcodeproj::Project.open(File.join(root, 'ios/App/App.xcodeproj'))
app = project.targets.find { |target| target.name == 'App' }
raise 'App target missing' unless app
raise 'Screenshot target already exists' if project.targets.any? { |target| target.name == 'NativeScreenshots' }
target = project.new_target(:ui_test_bundle, 'NativeScreenshots', :ios, '15.0')
target.add_dependency(app)
source = project.main_group.new_file(File.join(root, 'scripts/NativeScreenshots.swift'))
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
scheme.save_as(project.path, 'NativeScreenshots', true)
