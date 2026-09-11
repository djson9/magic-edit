defmodule MagicEditCaptureWeb.HealthController do
  @moduledoc false
  use Phoenix.Controller, formats: [:json]

  def show(conn, _params) do
    revision = Application.fetch_env!(:magic_edit_capture, :release_revision)

    if MagicEditCapture.Storage.ready?() do
      json(conn, %{ok: true, revision: revision, storage: "ready"})
    else
      conn
      |> put_status(:service_unavailable)
      |> json(%{ok: false, revision: revision, storage: "unavailable"})
    end
  end
end
