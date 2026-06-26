require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name             = 'glass-view'
  s.version          = package['version']
  s.summary          = package['description']
  s.license          = { type: 'MIT' }
  s.homepage         = 'https://github.com/Duracell27'
  s.author           = 'Duracell27'
  s.platform         = :ios, '16.4'
  s.swift_version    = '5.9'
  s.source           = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files     = 'ios/**/*.{swift}'
end
