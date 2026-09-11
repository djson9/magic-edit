defmodule MagicEditCaptureWeb.CaptureController do
  @moduledoc false
  use Phoenix.Controller, formats: [:json]

  alias MagicEditCapture.Storage

  def options(conn, _params), do: send_resp(conn, 204, "")

  def create(conn, _params) do
    with {:ok, app_id} <- required_header(conn, "x-magic-edit-app-id"),
         {:ok, "1"} <- required_header(conn, "x-magic-edit-schema-version"),
         true <- json_content_type?(conn),
         {:ok, conn, capture} <- Storage.store(conn, app_id) do
      capture_url = public_url("/api/v1/captures/#{capture.capture_id}")
      latest_url = public_url("/api/v1/captures/latest?appId=#{URI.encode_www_form(app_id)}")

      conn
      |> put_status(:created)
      |> put_resp_header("location", capture_url)
      |> put_resp_header("x-magic-edit-capture-id", capture.capture_id)
      |> json(%{
        ok: true,
        captureId: capture.capture_id,
        captureUrl: capture_url,
        latestUrl: latest_url,
        storedAt: capture.stored_at,
        byteSize: capture.byte_size
      })
    else
      {:error, :missing_header} -> error(conn, 400, "invalid_headers")
      {:ok, _unsupported_schema} -> error(conn, 400, "invalid_headers")
      false -> error(conn, 400, "invalid_content_type")
      {:error, _reason, conn} -> error(conn, 500, "capture_write_failed")
    end
  end

  def show(conn, %{"capture_id" => capture_id}) do
    case Storage.capture(capture_id) do
      {:ok, path, size} -> send_capture(conn, capture_id, path, size)
      {:error, _reason} -> error(conn, 404, "capture_not_found")
    end
  end

  def latest(conn, %{"appId" => app_id}) when is_binary(app_id) and byte_size(app_id) > 0 do
    case Storage.latest(app_id) do
      {:ok, capture_id, path, size} -> send_capture(conn, capture_id, path, size)
      {:error, _reason} -> error(conn, 404, "capture_not_found")
    end
  end

  def latest(conn, _params), do: error(conn, 400, "invalid_app_id")

  defp send_capture(conn, capture_id, path, size) do
    conn
    |> put_resp_content_type("application/json")
    |> put_resp_header("content-length", Integer.to_string(size))
    |> put_resp_header("x-magic-edit-capture-id", capture_id)
    |> send_file(200, path)
  end

  defp required_header(conn, name) do
    case get_req_header(conn, name) do
      [value] when byte_size(value) > 0 -> {:ok, value}
      _ -> {:error, :missing_header}
    end
  end

  defp json_content_type?(conn) do
    case get_req_header(conn, "content-type") do
      [value | _] -> String.starts_with?(String.downcase(value), "application/json")
      _ -> false
    end
  end

  defp public_url(path), do: Application.fetch_env!(:magic_edit_capture, :public_origin) <> path

  defp error(conn, status, code),
    do: conn |> put_status(status) |> json(%{ok: false, error: code})
end
