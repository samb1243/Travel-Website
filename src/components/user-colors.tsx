import { cleanCustomColors, customColorsCss } from "@/lib/colors";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/session";
import { ColorsCache } from "@/components/colors-cache";

/**
 * The signed-in person's own colour coding, as CSS variables over the defaults.
 * The values are checked "#rrggbb" colours and known keys only, so nothing
 * else can get into the CSS.
 */
export async function UserColors() {
  const user = await getCurrentUser();
  const row = user ? await db.user.findUnique({ where: { id: user.id }, select: { colors: true } }) : null;
  const css = customColorsCss(cleanCustomColors(row?.colors));
  return (
    <>
      {css ? <style id="user-colors" dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <ColorsCache css={css} />
    </>
  );
}
