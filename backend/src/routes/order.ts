import { Hono } from 'hono';
import { MeicanService } from '../services/meican';

const order = new Hono();

/**
 * POST /api/orders/add
 * Place a new order
 * 
 * Body (form-urlencoded):
 * - tabUniqueId: string
 * - order: JSON string [{"count":1, "dishId": 123}]
 * - remarks: JSON string [{"dishId":"123", "remark":""}]
 * - targetTime: YYYY-MM-DD HH:mm
 * - userAddressUniqueId: string
 * - corpAddressUniqueId: string
 * - corpAddressRemark: string (optional)
 */
order.post('/add', async (c) => {
  const auth = c.get('auth');
  
  try {
    const contentType = c.req.header('Content-Type');
    let orderData: Record<string, string>;

    if (contentType?.includes('application/json')) {
      const body = await c.req.json();
      orderData = {
        tabUniqueId: body.tabUniqueId,
        order: typeof body.order === 'string' ? body.order : JSON.stringify(body.order),
        remarks: typeof body.remarks === 'string' ? body.remarks : JSON.stringify(body.remarks || []),
        targetTime: body.targetTime,
        userAddressUniqueId: body.userAddressUniqueId,
        corpAddressUniqueId: body.corpAddressUniqueId,
      };
      if (body.corpAddressRemark) {
        orderData.corpAddressRemark = body.corpAddressRemark;
      }
    } else {
      const formData = await c.req.parseBody();
      orderData = {
        tabUniqueId: formData.tabUniqueId as string,
        order: formData.order as string,
        remarks: formData.remarks as string,
        targetTime: formData.targetTime as string,
        userAddressUniqueId: formData.userAddressUniqueId as string,
        corpAddressUniqueId: formData.corpAddressUniqueId as string,
      };
      if (formData.corpAddressRemark) {
        orderData.corpAddressRemark = formData.corpAddressRemark as string;
      }
    }

    // Validate required fields
    const requiredFields = ['tabUniqueId', 'order', 'targetTime', 'userAddressUniqueId', 'corpAddressUniqueId'];
    for (const field of requiredFields) {
      if (!orderData[field]) {
        return c.json({ error: `Missing required field: ${field}` }, 400);
      }
    }

    const data = await MeicanService.addOrder(orderData, auth);
    return c.json(data);
  } catch (error) {
    console.error('[Order] Error adding order:', error);
    return c.json({ 
      error: 'Failed to add order',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/orders/delete
 * Delete an existing order
 * 
 * Body (form-urlencoded):
 * - uniqueId: string (required)
 * - type: string (default: CORP_ORDER)
 * - restoreCart: string (default: false)
 */
order.post('/delete', async (c) => {
  const auth = c.get('auth');
  
  try {
    const contentType = c.req.header('Content-Type');
    let uniqueId: string;
    let type: string;
    let restoreCart: string;

    if (contentType?.includes('application/json')) {
      const body = await c.req.json();
      uniqueId = body.uniqueId;
      type = body.type || 'CORP_ORDER';
      restoreCart = String(body.restoreCart ?? false);
    } else {
      const formData = await c.req.parseBody();
      uniqueId = formData.uniqueId as string;
      type = (formData.type as string) || 'CORP_ORDER';
      restoreCart = (formData.restoreCart as string) || 'false';
    }

    if (!uniqueId) {
      return c.json({ error: 'uniqueId is required' }, 400);
    }

    const data = await MeicanService.deleteOrder(uniqueId, type, restoreCart, auth);
    return c.json(data);
  } catch (error) {
    console.error('[Order] Error deleting order:', error);
    return c.json({ 
      error: 'Failed to delete order',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default order;
