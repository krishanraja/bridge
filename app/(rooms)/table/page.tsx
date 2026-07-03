import { redirect } from "next/navigation";
import { getTable, getDecisionLog } from "@/lib/data";
import { currentSeat } from "@/lib/auth";
import { TableRoom } from "@/components/rooms/TableRoom";

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const seat = await currentSeat();
  if (!seat) redirect("/login");
  const [data, log] = await Promise.all([getTable(), getDecisionLog()]);

  return <TableRoom data={data} log={log} seat={seat} />;
}
