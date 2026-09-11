defmodule MagicEditCaptureWeb.CaptureControllerTest do
  use ExUnit.Case, async: false
  import Plug.Conn
  import Phoenix.ConnTest

  @endpoint MagicEditCaptureWeb.Endpoint

  setup do
    root =
      Path.join(System.tmp_dir!(), "magic-edit-capture-#{System.unique_integer([:positive])}")

    previous = Application.fetch_env!(:magic_edit_capture, :storage_root)
    Application.put_env(:magic_edit_capture, :storage_root, root)

    on_exit(fn ->
      Application.put_env(:magic_edit_capture, :storage_root, previous)
      File.rm_rf!(root)
    end)

    %{root: root}
  end

  test "stores a multi-chunk body byte-for-byte and retrieves it by ID and app", %{root: root} do
    body =
      Jason.encode!(%{
        schemaVersion: 1,
        app: %{id: "com.example.raw"},
        state: String.duplicate("all-state-", 150_000)
      })

    create =
      build_conn()
      |> put_req_header("content-type", "application/json")
      |> put_req_header("x-magic-edit-app-id", "com.example.raw")
      |> put_req_header("x-magic-edit-schema-version", "1")
      |> post("/api/v1/captures", body)

    receipt = json_response(create, 201)
    capture_id = receipt["captureId"]
    assert receipt["byteSize"] == byte_size(body)
    assert File.read!(Path.join([root, "captures", capture_id <> ".json"])) == body

    exact = get(build_conn(), "/api/v1/captures/#{capture_id}")
    assert response(exact, 200) == body
    assert get_resp_header(exact, "x-magic-edit-capture-id") == [capture_id]

    latest = get(build_conn(), "/api/v1/captures/latest?appId=com.example.raw")
    assert response(latest, 200) == body
    assert get_resp_header(latest, "x-magic-edit-capture-id") == [capture_id]
    assert get_resp_header(create, "access-control-allow-origin") == ["*"]
  end

  test "rejects invalid transport headers without publishing a capture", %{root: root} do
    response =
      build_conn()
      |> put_req_header("content-type", "application/json")
      |> post("/api/v1/captures", "{}")

    assert json_response(response, 400) == %{"ok" => false, "error" => "invalid_headers"}
    refute File.exists?(Path.join(root, "captures"))
  end

  test "returns CORS preflight and stable missing-capture responses" do
    preflight = options(build_conn(), "/api/v1/captures")
    assert response(preflight, 204) == ""
    assert get_resp_header(preflight, "access-control-allow-methods") == ["GET, POST, OPTIONS"]

    missing = get(build_conn(), "/api/v1/captures/00000000-0000-4000-8000-000000000000")
    assert json_response(missing, 404) == %{"ok" => false, "error" => "capture_not_found"}
  end
end
