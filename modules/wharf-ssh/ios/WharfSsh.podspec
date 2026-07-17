Pod::Spec.new do |s|
  s.name           = 'WharfSsh'
  s.version        = '0.1.0'
  s.summary        = 'Native SSH terminal engine (gomobile-backed) for the Wharf mobile app.'
  s.description    = 'Expo module bridging the gomobile-compiled Wharf SSH engine: interactive shells, TOFU host-key prompts, password + keyboard-interactive auth, streamed output and ring-buffer snapshots.'
  s.author         = 'Wharf'
  s.homepage       = 'https://github.com/Janne6565/wharf-mobile'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # The gomobile-compiled engine. This copy is committed alongside the module
  # (scripts/build-ssh-engine.sh rsyncs it here from sshengine/dist/ after a
  # successful iOS bind); the sshengine/dist/ build output stays git-ignored.
  s.vendored_frameworks = 'WharfSshEngine.xcframework'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Top-level only (NOT recursive): a recursive glob would also pull the gomobile
  # headers inside WharfSshEngine.xcframework/**/Headers into the pod's own sources
  # and clash with the vendored framework's module. Only our Swift lives here.
  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
