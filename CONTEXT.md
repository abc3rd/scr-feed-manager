# SCR Feed

Sweet Cypress Ranch's ordering and fulfillment app: Client #1 of SynCloud Connect. Platform terms (Client, Location, Customer, Member, Stars, Stars Club) are defined in [syncloudconnect-main/CONTEXT.md](https://github.com/abc3rd/syncloudconnect-main/blob/main/CONTEXT.md); this file holds only SCR's own terms.

## Language

**Order**:
A Customer's request for products, placed online or from a barn QR, that is fulfilled in two steps.
_Avoid_: purchase, sale (before it is fulfilled)

**Pick Ticket**:
The internal job created for an Order that a Yard Worker fills and verifies at the loading dock. Stock is deducted only when it is marked done.
_Avoid_: pick list, work order

**Yard Worker**:
A staff member who pulls the products on a Pick Ticket and confirms the physical count.
_Avoid_: picker, warehouse staff

**Short Pick**:
A Pick Ticket line where the Yard Worker counted fewer units than the Order asked for.
_Avoid_: backorder, partial

**Reserved Stock**:
Stock held by open Orders awaiting pick verification; it is not yet deducted.
_Avoid_: allocated, committed, on hold

**Needs a Price**:
A product with no price set; it can be shown but never sold until staff set the price.
_Avoid_: free item, $0 item

**Barn QR**:
The sticker in a Member's barn that opens their quick-order page.
_Avoid_: member code, barn code

**Product QR**:
The sticker on a shelf in a Location that opens that product's page.
_Avoid_: SKU code, shelf code

**Hay Announcement**:
A staff alert pushed to Customers when fresh inventory such as hay arrives at the dock.
_Avoid_: notification, promo
