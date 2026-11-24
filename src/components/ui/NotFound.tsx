import { ButtonLink } from "./Button";
import { Icon } from "./Icon";
import { Screen } from "./Screen";
import { TopBar } from "./TopBar";

export function NotFound({ title, body }: { title: string; body: string }) {
  return (
    <Screen>
      <TopBar menu={false} elevated={false} />
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <span className="grid size-16 place-items-center rounded-2xl bg-surface-3 text-text-2">
          <Icon name="travel_explore" size={32} />
        </span>
        <h1 className="mt-5 text-xl font-medium">{title}</h1>
        <p className="mt-2 text-sm text-text-2">{body}</p>
        <ButtonLink href="/" className="mt-6">
          Go home
        </ButtonLink>
      </div>
    </Screen>
  );
}
