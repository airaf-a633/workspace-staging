import { TaskList } from "@/components/tasks/task-list";
import { previewTasks } from "@/lib/preview";
import { getT, getTimeZone } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("tasks") };
}

export default async function PreviewTasks(props: PageProps<"/preview/[as]/tasks">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  const { data, tasks, customers } = previewTasks(as, tz);
  return <TaskList tasks={tasks} people={data.people} customers={customers} viewer={data.viewer} now={data.now} base={`/preview/${as}`} />;
}
