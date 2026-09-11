defmodule MagicEditCaptureWeb.CORS do
  @moduledoc false
  import Plug.Conn

  def init(options), do: options

  def call(conn, _options) do
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, OPTIONS")
    |> put_resp_header(
      "access-control-allow-headers",
      "content-type, x-magic-edit-app-id, x-magic-edit-internal, x-magic-edit-schema-version"
    )
    |> put_resp_header("access-control-expose-headers", "location, x-magic-edit-capture-id")
  end
end
