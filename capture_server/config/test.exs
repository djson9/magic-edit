import Config

config :magic_edit_capture,
  public_origin: "https://magicedit.test",
  release_revision: "test"

config :magic_edit_capture, MagicEditCaptureWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 8491],
  server: false

config :logger, level: :warning
