import fs from 'node:fs'
import path from 'node:path'
import xcode from 'xcode'

const projectPath = path.resolve('ios/App/App.xcodeproj/project.pbxproj')
const project = xcode.project(projectPath)
project.parseSync()

const appTarget = project.getFirstTarget()

// 1. Add LiveActivityPlugin.swift and PracticeActivityAttributes.swift to App target if not already present
const appSources =
  project.hash.project.objects.PBXSourcesBuildPhase[
    appTarget.firstTarget.buildPhases[0].value
  ].files
const appSourceComments = appSources.map((f) => f.comment)

if (
  !appSourceComments.includes('PracticeActivityAttributes.swift in Sources')
) {
  project.addSourceFile('PracticeActivityAttributes.swift', null, 'App')
}
if (!appSourceComments.includes('LiveActivityPlugin.swift in Sources')) {
  project.addSourceFile('LiveActivityPlugin.swift', null, 'App')
}

// 2. Add ActivityKit framework to App target
const appFrameworks =
  project.hash.project.objects.PBXFrameworksBuildPhase[
    appTarget.firstTarget.buildPhases[1].value
  ].files
const appFrameworkComments = appFrameworks.map((f) => f.comment)
if (!appFrameworkComments.includes('ActivityKit.framework in Frameworks')) {
  project.addFramework('ActivityKit.framework', {
    target: appTarget.uuid,
    weak: true,
  })
}

// 3. Add JolitoWidgetExtension target if not present
const existingTargets = Object.keys(project.pbxNativeTargetSection()).map(
  (k) => {
    const t = project.pbxNativeTargetSection()[k]
    return t && t.name ? t.name.replace(/"/g, '') : ''
  },
)

if (!existingTargets.includes('JolitoWidgetExtension')) {
  const widgetTarget = project.addTarget(
    'JolitoWidgetExtension',
    'app_extension',
    'JolitoWidgetExtension',
    'to.joli.app.widget',
  )

  // Build phases
  project.addBuildPhase(
    [],
    'PBXSourcesBuildPhase',
    'Sources',
    widgetTarget.uuid,
  )
  project.addBuildPhase(
    [],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    widgetTarget.uuid,
  )
  project.addBuildPhase(
    [],
    'PBXResourcesBuildPhase',
    'Resources',
    widgetTarget.uuid,
  )

  // Frameworks
  project.addFramework('WidgetKit.framework', { target: widgetTarget.uuid })
  project.addFramework('SwiftUI.framework', { target: widgetTarget.uuid })
  project.addFramework('ActivityKit.framework', { target: widgetTarget.uuid })

  // PBXGroup
  const group = project.addPbxGroup(
    [],
    'JolitoWidgetExtension',
    'JolitoWidgetExtension',
  )
  project.addToPbxGroup(
    group.uuid,
    project.getFirstProject().firstProject.mainGroup,
  )

  // Source files in widget extension
  project.addSourceFile(
    'JolitoWidgetBundle.swift',
    { target: widgetTarget.uuid },
    'JolitoWidgetExtension',
  )
  project.addSourceFile(
    'PracticeLiveActivityWidget.swift',
    { target: widgetTarget.uuid },
    'JolitoWidgetExtension',
  )
  project.addSourceFile(
    'PracticeActivityAttributes.swift',
    { target: widgetTarget.uuid },
    'JolitoWidgetExtension',
  )
  project.addResourceFile(
    'Info.plist',
    { target: widgetTarget.uuid },
    'JolitoWidgetExtension',
  )

  // Build configurations for widget extension
  const configurations = project.pbxXCBuildConfigurationSection()
  for (const key in configurations) {
    const config = configurations[key]
    if (
      config &&
      config.buildSettings &&
      config.buildSettings.PRODUCT_NAME === '"JolitoWidgetExtension"'
    ) {
      config.buildSettings.SWIFT_VERSION = '5.0'
      config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '16.1'
      config.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"'
      config.buildSettings.INFOPLIST_FILE = 'JolitoWidgetExtension/Info.plist'
      config.buildSettings.GENERATE_INFOPLIST_FILE = 'NO'
      config.buildSettings.CODE_SIGN_STYLE = 'Automatic'
      config.buildSettings.CURRENT_PROJECT_VERSION =
        '$(CURRENT_PROJECT_VERSION)'
      config.buildSettings.MARKETING_VERSION = '$(MARKETING_VERSION)'
      if (config.name === 'Release') {
        config.buildSettings.CODE_SIGN_IDENTITY = '"Apple Distribution"'
      }
    }
  }
}

fs.writeFileSync(projectPath, project.writeSync())
console.log('project.pbxproj configured successfully.')
