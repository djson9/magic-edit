defmodule MagicEditCapture.Storage do
  @moduledoc false

  alias Plug.Conn

  @capture_id ~r/\A[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/
  @read_length 1_048_576

  def store(%Conn{} = conn, app_id) when is_binary(app_id) and byte_size(app_id) > 0 do
    capture_id = MagicEditCapture.Storage.UUID.uuid4()
    root = root()
    incoming_directory = Path.join([root, "captures", ".incoming"])
    capture_directory = Path.join(root, "captures")
    incoming = Path.join(incoming_directory, capture_id <> ".part")
    destination = Path.join(capture_directory, capture_id <> ".json")

    with :ok <- ensure_directories(root),
         {:ok, stream_result} <-
           File.open(incoming, [:write, :binary, :exclusive], fn device ->
             stream_body(conn, device, 0)
           end),
         {:ok, conn, byte_size} <- stream_result,
         :ok <- File.rename(incoming, destination),
         stored_at = DateTime.utc_now() |> DateTime.truncate(:millisecond),
         :ok <- publish_latest(root, app_id, capture_id, stored_at, byte_size) do
      {:ok, conn,
       %{
         capture_id: capture_id,
         stored_at: DateTime.to_iso8601(stored_at),
         byte_size: byte_size
       }}
    else
      {:error, reason} ->
        File.rm(incoming)
        {:error, reason, conn}

      {:ok, {:error, reason}} ->
        File.rm(incoming)
        {:error, reason, conn}
    end
  end

  def capture(capture_id) when is_binary(capture_id) do
    if Regex.match?(@capture_id, capture_id) do
      regular_file(Path.join([root(), "captures", capture_id <> ".json"]))
    else
      {:error, :invalid_capture_id}
    end
  end

  def latest(app_id) when is_binary(app_id) and byte_size(app_id) > 0 do
    pointer = Path.join([root(), "latest", app_hash(app_id) <> ".json"])

    with {:ok, raw} <- File.read(pointer),
         {:ok, %{"appId" => ^app_id, "captureId" => capture_id}} <- Jason.decode(raw),
         {:ok, path, size} <- capture(capture_id) do
      {:ok, capture_id, path, size}
    else
      {:error, :enoent} -> {:error, :not_found}
      _ -> {:error, :invalid_pointer}
    end
  end

  def ready? do
    root = root()
    probe = Path.join(root, ".health-#{MagicEditCapture.Storage.UUID.uuid4()}")

    with :ok <- ensure_directories(root),
         :ok <- File.write(probe, "ok", [:exclusive]),
         :ok <- File.rm(probe) do
      true
    else
      _ ->
        File.rm(probe)
        false
    end
  end

  def root, do: Application.fetch_env!(:magic_edit_capture, :storage_root)

  defp stream_body(conn, device, byte_size) do
    case Conn.read_body(conn,
           length: @read_length,
           read_length: @read_length,
           read_timeout: 60_000
         ) do
      {:ok, body, conn} ->
        with :ok <- IO.binwrite(device, body) do
          {:ok, conn, byte_size + byte_size(body)}
        end

      {:more, body, conn} ->
        with :ok <- IO.binwrite(device, body) do
          stream_body(conn, device, byte_size + byte_size(body))
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp publish_latest(root, app_id, capture_id, stored_at, byte_size) do
    pointer_directory = Path.join(root, "latest")
    pointer = Path.join(pointer_directory, app_hash(app_id) <> ".json")
    incoming = pointer <> ".#{capture_id}.part"

    document =
      Jason.encode!(%{
        "appId" => app_id,
        "byteSize" => byte_size,
        "captureId" => capture_id,
        "storedAt" => DateTime.to_iso8601(stored_at)
      })

    with :ok <- File.write(incoming, document, [:binary, :exclusive]),
         :ok <- File.rename(incoming, pointer) do
      :ok
    else
      {:error, reason} ->
        File.rm(incoming)
        {:error, reason}
    end
  end

  defp ensure_directories(root) do
    with :ok <- File.mkdir_p(Path.join([root, "captures", ".incoming"])),
         :ok <- File.mkdir_p(Path.join(root, "latest")) do
      :ok
    end
  end

  defp regular_file(path) do
    with {:ok, %File.Stat{type: :regular, size: size}} <- File.stat(path) do
      {:ok, path, size}
    else
      {:error, :enoent} -> {:error, :not_found}
      _ -> {:error, :invalid_capture}
    end
  end

  defp app_hash(app_id) do
    :crypto.hash(:sha256, app_id) |> Base.encode16(case: :lower)
  end

  defmodule UUID do
    @moduledoc false

    def uuid4 do
      <<a::32, b::16, c::16, d::16, e::48>> = :crypto.strong_rand_bytes(16)
      c = Bitwise.band(c, 0x0FFF) |> Bitwise.bor(0x4000)
      d = Bitwise.band(d, 0x3FFF) |> Bitwise.bor(0x8000)

      Enum.join(
        [
          hex(a, 8),
          hex(b, 4),
          hex(c, 4),
          hex(d, 4),
          hex(e, 12)
        ],
        "-"
      )
    end

    defp hex(number, width) do
      number |> Integer.to_string(16) |> String.downcase() |> String.pad_leading(width, "0")
    end
  end
end
