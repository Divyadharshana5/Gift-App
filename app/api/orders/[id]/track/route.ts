import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import Order from "@/global/models/Order";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { AuthOptions } from "next-auth";
import { Session } from "next-auth";

type CustomSession = Session & {
  user: {
    id: string;
  };
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();

    // Check authentication
    const session = (await getServerSession(
      authOptions as unknown as AuthOptions
    )) as CustomSession;
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Find the order
    const order = await Order.findById(params.id);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (order.user.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // Return tracking information
    return NextResponse.json({
      success: true,
      orderId: order._id,
      status: order.status,
      tracking: order.tracking,
      deliveryPartner: order.deliveryPartner,
      estimatedDelivery: order.deliveryTime,
      recipient: order.recipient,
      deliveryAddress: order.deliveryAddress,
    });
  } catch (error) {
    console.error("Error fetching order tracking:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order tracking" },
      { status: 500 }
    );
  }
}
