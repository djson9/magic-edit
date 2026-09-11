defmodule MagicEditCaptureWeb.Router do
  use Phoenix.Router

  options "/*path", MagicEditCaptureWeb.CaptureController, :options
  get "/up", MagicEditCaptureWeb.HealthController, :show
  post "/api/v1/captures", MagicEditCaptureWeb.CaptureController, :create
  get "/api/v1/captures/latest", MagicEditCaptureWeb.CaptureController, :latest
  get "/api/v1/captures/:capture_id", MagicEditCaptureWeb.CaptureController, :show
end
