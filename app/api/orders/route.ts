import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/global/lib/mongodb";
import Order, { OrderValidationSchema, IOrder } from "@/global/models/Order";
import Gift from "@/global/models/Gift";
import { validateData } from "@/global/lib/validate";
import { AuthOptions, getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { Session } from "next-auth";
import mongoose, { FilterQuery } from "mongoose";

type CustomSession = Session & {
  user: {
    id: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    // Connect to database
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

    // Parse request body
    const body = await req.json();

    // Add user ID to order data
    body.user = session.user.id;

    // Set delivery time - default to 1 hour from now
    if (!body.deliveryTime) {
      const deliveryTime = new Date();
      deliveryTime.setHours(deliveryTime.getHours() + 1);
      body.deliveryTime = deliveryTime;
    }

    // Validate with Zod schema
    const validation = await validateData(OrderValidationSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, errors: validation.errors },
        { status: 400 }
      );
    }

    // Start a session for transaction
    const orderSession = await mongoose.startSession();
    orderSession.startTransaction();

    try {
      // Check if all gifts are in stock and update inventory
      for (const item of (
        validation.data as {
          items: { gift: string; quantity: number; price: number }[];
        }
      ).items) {
        const gift = await Gift.findById(item.gift).session(orderSession);

        if (!gift || !gift.inStock || gift.stockCount < item.quantity) {
          throw new Error(`Gift ${item.gift} is out of stock or unavailable`);
        }

        // Update stock
        gift.stockCount -= item.quantity;
        if (gift.stockCount === 0) {
          gift.inStock = false;
        }

        await gift.save({ session });
      }

      // Create order
      const order = new Order(validation.data);

      // Add initial tracking event
      order.tracking = [
        {
          status: "pending",
          timestamp: new Date(),
          description: "Order received",
        },
      ];

      await order.save({ session });

      // Commit the transaction
      await orderSession.commitTransaction();

      return NextResponse.json({ success: true, order }, { status: 201 });
    } catch (error) {
      // Abort the transaction on error
      await orderSession.abortTransaction();
      throw error;
    } finally {
      // End the session
      await orderSession.endSession();
    }
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create order",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Connect to database
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

    const searchParams = req.nextUrl.searchParams;

    // Get user orders with pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Filter by status if provided
    const filter: FilterQuery<IOrder> = { user: session.user.id };
    if (searchParams.has("status")) {
      filter.status = searchParams.get("status");
    }

    // Get orders
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "items.gift",
        select: "name images price category", // Only select necessary fields
      });

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(filter);

    return NextResponse.json({
      success: true,
      orders,
      pagination: {
        total: totalOrders,
        page,
        limit,
        pages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
