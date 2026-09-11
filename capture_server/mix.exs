defmodule MagicEditCapture.MixProject do
  use Mix.Project

  def project do
    [
      app: :magic_edit_capture,
      version: "0.1.0",
      elixir: "~> 1.14",
      elixirc_options: [warnings_as_errors: true],
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      mod: {MagicEditCapture.Application, []},
      extra_applications: [:logger, :runtime_tools, :crypto]
    ]
  end

  defp deps do
    [
      {:phoenix, "== 1.7.24"},
      {:bandit, "== 1.12.5"},
      {:jason, "== 1.4.5"}
    ]
  end
end
