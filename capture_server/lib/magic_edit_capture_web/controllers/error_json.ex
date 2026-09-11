defmodule MagicEditCaptureWeb.ErrorJSON do
  @moduledoc false

  def render(template, _assigns) do
    %{ok: false, error: Phoenix.Controller.status_message_from_template(template)}
  end
end
