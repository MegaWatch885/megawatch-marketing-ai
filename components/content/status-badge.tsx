import clsx from "clsx";

interface Props {
  status: string;
}

export default function StatusBadge({
  status,
}: Props) {
  return (
    <span
      className={clsx(
        "px-2 py-1 rounded text-xs font-medium",
        {
          "bg-green-100 text-green-700":
            status === "uploaded",

          "bg-yellow-100 text-yellow-700":
            status === "processing",

          "bg-blue-100 text-blue-700":
            status === "ready",

          "bg-red-100 text-red-700":
            status === "failed",
        }
      )}
    >
      {status}
    </span>
  );
}