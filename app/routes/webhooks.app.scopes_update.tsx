import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    let payload: { current?: string[] };
    let session: Awaited<ReturnType<typeof authenticate.webhook>>["session"];
    let topic: string;
    let shop: string;

    try {
        const auth = await authenticate.webhook(request);
        payload = auth.payload as { current?: string[] };
        session = auth.session;
        topic = auth.topic;
        shop = auth.shop;
    } catch (error) {
        console.error("Webhook HMAC verification failed:", error);
        return new Response("Unauthorized", { status: 401 });
    }

    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        await db.session.update({   
            where: {
                id: session.id
            },
            data: {
                scope: current.toString(),
            },
        });
    }
    return new Response();
};
