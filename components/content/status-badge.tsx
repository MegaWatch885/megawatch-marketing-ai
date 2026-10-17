interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({
  status,
}: StatusBadgeProps) {
  const config: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    uploaded: {
      label: "Uploaded",
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    },

    processing: {
      label: "Processing",
      className:
        "bg-yellow-50 text-yellow-700 border-yellow-200",
    },

    ready: {
      label: "Ready",
      className:
        "bg-blue-50 text-blue-700 border-blue-200",
    },

    scheduled: {
      label: "Scheduled",
      className:
        "bg-purple-50 text-purple-700 border-purple-200",
    },

    published: {
      label: "Published",
      className:
        "bg-green-50 text-green-700 border-green-200",
    },
  };

  const current =
    config[status] || {
      label: status || "Unknown",
      className:
        "bg-gray-100 text-gray-700 border-gray-200",
    };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${current.className}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current"
        aria-hidden="true"
      />

      {current.label}
    </span>
  );
}