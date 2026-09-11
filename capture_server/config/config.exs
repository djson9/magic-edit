import Config

config :magic_edit_capture,
  public_origin: "https://magicedit.dev",
  release_revision: "development",
  storage_root: "/mnt/b2/magic-edit"

config :magic_edit_capture, MagicEditCaptureWeb.Endpoint,
  adapter: Bandit.PhoenixAdapter,
  http: [ip: {127, 0, 0, 1}, port: 8490],
  render_errors: [formats: [json: MagicEditCaptureWeb.ErrorJSON], layout: false],
  pubsub_server: MagicEditCapture.PubSub,
  secret_key_base: String.duplicate("magic-edit-capture-development-", 3),
  server: false

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

import_config "#{config_env()}.exs"
