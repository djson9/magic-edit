import Config

if config_env() == :prod do
  port = String.to_integer(System.get_env("PORT", "8490"))

  config :magic_edit_capture,
    public_origin: System.get_env("MAGIC_EDIT_PUBLIC_ORIGIN", "https://magicedit.dev"),
    release_revision: System.get_env("RELEASE_REVISION", "unknown"),
    storage_root: System.get_env("MAGIC_EDIT_STORAGE_ROOT", "/mnt/b2/magic-edit")

  config :magic_edit_capture, MagicEditCaptureWeb.Endpoint,
    http: [ip: {127, 0, 0, 1}, port: port],
    secret_key_base: System.fetch_env!("SECRET_KEY_BASE"),
    server: true
end
