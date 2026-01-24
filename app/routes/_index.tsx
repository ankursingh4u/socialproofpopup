import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return login(request);
};

export default function App() {
  return (
    <div style={{ padding: "20px" }}>
      <h1>Social Proof Popup</h1>
      <p>Please install this app on your Shopify store to continue.</p>
    </div>
  );
}
