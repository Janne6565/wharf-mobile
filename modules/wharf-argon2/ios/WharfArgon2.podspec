Pod::Spec.new do |s|
  s.name           = 'WharfArgon2'
  s.version        = '0.1.0'
  s.summary        = 'Native argon2id (raw bytes, parallelism-aware) for the Wharf vault.'
  s.description    = 'Expo module wrapping Argon2Swift to derive argon2id keys over raw byte secrets honouring parallelism, byte-compatible with Go argon2.IDKey.'
  s.author         = 'Wharf'
  s.homepage       = 'https://github.com/Janne6565/wharf-mobile'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # Native argon2 with a configurable parallelism parameter and raw-bytes input.
  s.dependency 'Argon2Swift'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
