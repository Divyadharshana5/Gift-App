import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import Order from "@/global/models/Order";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
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

    // Get order with populated gift info
    const order = await Order.findById(params.id).populate({
      path: "items.gift",
      select: "name images price description category ageRange gender",
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // Check that the order belongs to the authenticated user
    if (order.user.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Validate request data - only allow updating special instructions or cancellation
    const body = await req.json();

    // Check if order can be updated (only pending or confirmed orders can be updated)
    if (!["pending", "confirmed"].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: "Order cannot be updated at this stage" },
        { status: 400 }
      );
    }

    // Update allowed fields
    if (body.specialInstructions !== undefined) {
      order.specialInstructions = body.specialInstructions;
    }

    // Handle cancellation requests
    if (
      body.status === "canceled" &&
      ["pending", "confirmed"].includes(order.status)
    ) {
      order.status = "canceled";

      // Add tracking event for cancellation
      order.tracking.push({
        status: "canceled",
        timestamp: new Date(),
        description: body.cancellationReason || "Canceled by customer",
      });
    }

    await order.save();

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update order" },
      { status: 500 }
    );
  }
}
