require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'DJSON9MagicEdit'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = package['homepage']
  spec.license = { type: 'MIT' }
  spec.author = { 'djson9' => 'djson9' }
  spec.source = { git: 'https://github.com/djson9/magic-edit.git', tag: "v#{spec.version}" }
  spec.platform = :ios, '15.1'
  spec.swift_version = '5.0'
  spec.source_files = 'ios/**/*.{m,swift}'
  spec.dependency 'React-Core'
  spec.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
