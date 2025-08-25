import { NextRequest } from "next/server";
import { GET as FileGET } from "../route";

export const revalidate = 0;

// No need to authenticate this route since
// it calls the other GET handler which is authenticated.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const data = await FileGET(request, { params });

  if (data.status === 200) {
    const json = await data.json();

    // The actual file is stored in `data` field.
    return new Response(json.data);
  }

  // Otherwise return the response from other GET handler as it is.
  return data;
}
