/* The wizard runs full screen, with no tab bar: one thing at a time, nothing to
   distract from the single tap. */

export default function SetupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="app-frame">{children}</div>;
}
