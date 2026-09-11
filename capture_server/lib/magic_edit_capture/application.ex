defmodule MagicEditCapture.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      {Phoenix.PubSub, name: MagicEditCapture.PubSub},
      MagicEditCaptureWeb.Endpoint
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: MagicEditCapture.Supervisor)
  end

  @impl true
  def config_change(changed, _new, removed) do
    MagicEditCaptureWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
