defmodule MagicEditCaptureWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :magic_edit_capture

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  plug :load_query_params
  plug MagicEditCaptureWeb.CORS
  plug MagicEditCaptureWeb.Router

  defp load_query_params(conn, _options), do: Plug.Conn.fetch_query_params(conn)
end
