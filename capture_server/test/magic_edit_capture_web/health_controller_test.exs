defmodule MagicEditCaptureWeb.HealthControllerTest do
  use ExUnit.Case, async: false
  import Phoenix.ConnTest

  @endpoint MagicEditCaptureWeb.Endpoint

  setup do
    root = Path.join(System.tmp_dir!(), "magic-edit-health-#{System.unique_integer([:positive])}")
    previous = Application.fetch_env!(:magic_edit_capture, :storage_root)
    Application.put_env(:magic_edit_capture, :storage_root, root)

    on_exit(fn ->
      Application.put_env(:magic_edit_capture, :storage_root, previous)
      File.rm_rf!(root)
    end)

    %{root: root}
  end

  test "reports the release revision when storage is writable" do
    conn = get(build_conn(), "/up")
    assert json_response(conn, 200) == %{"ok" => true, "revision" => "test", "storage" => "ready"}
  end

  test "reports unavailable when the configured root is a regular file", %{root: root} do
    File.write!(root, "not-a-directory")
    conn = get(build_conn(), "/up")

    assert json_response(conn, 503) == %{
             "ok" => false,
             "revision" => "test",
             "storage" => "unavailable"
           }
  end
end
