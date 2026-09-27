import { format } from "date-fns";
import StatusBadge from "./status-badge";
import Link from "next/link";

interface Props {
    item: any;
}

export default function ContentCard({
    item,
}: Props) {
    return (
        <div className="border rounded-xl overflow-hidden bg-white">
            <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-5xl">
                🎬
            </div>


            <div className="p-4 space-y-2">
                <h3 className="font-semibold">
                    {item.title}
                </h3>

                <StatusBadge
                    status={item.status}
                />

                <p className="text-xs text-gray-500">
                    {format(
                        new Date(item.created_at),
                        "dd MMM yyyy"
                    )}
                </p>
            </div>


            <Link
                href={`/content-library/${item.id}`}
                className="text-sm font-medium"
            >
                View Details →
            </Link>


        </div>


    );

}