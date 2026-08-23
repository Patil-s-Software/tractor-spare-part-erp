import { prisma } from '../../database';
import { ERROR_CODES, INVOICE_STATUS, MOVEMENT_TYPES, PAYMENT_STATUS, SALE_STATUS } from '../../constants';
import { AppError } from '../../middlewares/error-handler.middleware';
import { addMoney, calculateGst, mulMoney, round2, subMoney } from '../../utils/money';

export class SalesRepository {
  async generateSaleNumber(): Promise<string> {
    const count = await prisma.sale.count();
    return `SL-DRAFT-${(count + 1).toString().padStart(6, '0')}`;
  }

  async getNextSequenceNumber(tx: any, docType: string, prefix: string): Promise<string> {
    const currentFY = '2026-2027';
    const seqs: any[] = await tx.$queryRaw`
      SELECT id, last_number FROM document_sequences 
      WHERE doc_type = ${docType} AND financial_year = ${currentFY} FOR UPDATE
    `;

    let lastNum = 0;
    if (seqs && seqs.length > 0) {
      lastNum = Number(seqs[0].last_number);
    }

    const nextNum = lastNum + 1;
    const seqFormatted = `${prefix}-${currentFY}-${nextNum.toString().padStart(6, '0')}`;

    if (seqs && seqs.length > 0) {
      await tx.documentSequence.update({
        where: { id: BigInt(seqs[0].id) },
        data: { lastNumber: nextNum, updatedAt: new Date() },
      });
    } else {
      await tx.documentSequence.create({
        data: {
          docType,
          prefix,
          financialYear: currentFY,
          lastNumber: nextNum,
        },
      });
    }

    return seqFormatted;
  }

  async findById(id: bigint) {
    return prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        saleItems: { include: { product: true } },
        invoice: true,
        payments: true,
      },
    });
  }

  async findAll(params: { page?: number; limit?: number; customerId?: bigint; saleStatus?: string; paymentStatus?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.customerId) where.customerId = params.customerId;
    if (params.saleStatus) where.saleStatus = params.saleStatus;
    if (params.paymentStatus) where.paymentStatus = params.paymentStatus;

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, name: true, mobile: true, customerCode: true } },
          _count: { select: { saleItems: true } },
        },
      }),
    ]);

    return { total, sales };
  }

  async createDraft(data: {
    saleNumber: string;
    customerId: bigint;
    items: Array<{
      productId: bigint;
      quantity: number;
      unitPrice?: number;
      discountAmount?: number;
    }>;
    discountAmount: number;
    paidAmount: number;
    paymentMethod?: string;
    createdBy: bigint;
  }) {
    return prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let gstTotal = 0;
      const saleItemsToCreate: any[] = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { unit: true },
        });

        if (!product || product.status !== 'ACTIVE') {
          throw new AppError(`Product ID ${item.productId} is not active or found`, 400, ERROR_CODES.VALIDATION_ERROR);
        }

        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(product.sellingPrice);
        const itemDiscount = item.discountAmount || 0;
        const lineSubtotal = mulMoney(unitPrice, item.quantity);
        const lineAfterDiscount = subMoney(lineSubtotal, itemDiscount);
        const { gstAmount } = calculateGst(lineAfterDiscount, product.gstPercent);
        const lineTotal = addMoney(lineAfterDiscount, gstAmount);

        subtotal = Number(addMoney(subtotal, lineSubtotal));
        gstTotal = Number(addMoney(gstTotal, gstAmount));

        saleItemsToCreate.push({
          productId: product.id,
          productNameSnapshot: product.name,
          partNumberSnapshot: product.partNumber,
          unitSnapshot: product.unit.shortCode || product.unit.name,
          quantity: item.quantity,
          unitPrice,
          gstPercent: product.gstPercent,
          cgstAmount: Number(round2(gstAmount.dividedBy(2))),
          sgstAmount: Number(round2(gstAmount.dividedBy(2))),
          igstAmount: 0,
          gstAmount: Number(gstAmount),
          discountAmount: itemDiscount,
          itemTotal: Number(lineTotal),
        });
      }

      const grandTotal = Number(subMoney(addMoney(subtotal, gstTotal), data.discountAmount));

      const sale = await tx.sale.create({
        data: {
          saleNumber: data.saleNumber,
          customerId: data.customerId,
          saleStatus: SALE_STATUS.DRAFT,
          paymentStatus: PAYMENT_STATUS.ROUGH,
          subtotal,
          discountAmount: data.discountAmount,
          cgstTotal: Number(round2(gstTotal / 2)),
          sgstTotal: Number(round2(gstTotal / 2)),
          igstTotal: 0,
          gstTotal,
          grandTotal,
          paidAmount: data.paidAmount,
          pendingAmount: grandTotal,
          createdBy: data.createdBy,
          saleItems: {
            create: saleItemsToCreate,
          },
        },
        include: {
          customer: true,
          saleItems: true,
        },
      });

      return sale;
    });
  }

  /**
   * 13-Step Atomic Finalization Transaction
   */
  async finalizeSaleTransaction(saleId: bigint, finalizedBy: bigint, idempotencyKey?: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Lock Sale Row (FOR UPDATE)
      const rawSales: any[] = await tx.$queryRaw`
        SELECT id, sale_status, customer_id, discount_amount, paid_amount FROM sales WHERE id = ${saleId} FOR UPDATE
      `;

      if (!rawSales || rawSales.length === 0) {
        throw new AppError('Sale record not found', 404, ERROR_CODES.NOT_FOUND);
      }

      const saleRow = rawSales[0];
      if (saleRow.sale_status !== SALE_STATUS.DRAFT) {
        throw new AppError(`Sale is not in DRAFT state (Current state: ${saleRow.sale_status})`, 400, ERROR_CODES.INVALID_STATUS_TRANSITION);
      }

      // Check Idempotency Key
      if (idempotencyKey) {
        const existingKey = await tx.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
        if (existingKey) {
          throw new AppError('Duplicate finalize request detected (Idempotency key match)', 409, ERROR_CODES.IDEMPOTENCY_MISMATCH);
        }
      }

      // 2. Validate Customer Active
      const customer = await tx.customer.findUnique({ where: { id: BigInt(saleRow.customer_id) } });
      if (!customer || customer.status !== 'ACTIVE') {
        throw new AppError('Customer is inactive or not found', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      // 3. Fetch sale items & lock inventory rows sorted by product_id to prevent deadlocks
      const saleItems = await tx.saleItem.findMany({
        where: { saleId },
        include: { product: true },
        orderBy: { productId: 'asc' },
      });

      if (!saleItems || saleItems.length === 0) {
        throw new AppError('Draft sale has no line items', 400, ERROR_CODES.VALIDATION_ERROR);
      }

      const sortedProductIds = saleItems.map((si) => si.productId).sort((a, b) => (a < b ? -1 : 1));
      
      // 4 & 5. Lock inventory & recalculate line items + verify stock
      let subtotal = 0;
      let gstTotal = 0;

      for (const item of saleItems) {
        if (item.product.status !== 'ACTIVE') {
          throw new AppError(`Product '${item.product.name}' is inactive`, 400, ERROR_CODES.VALIDATION_ERROR);
        }

        // Lock inventory row FOR UPDATE
        const invRows: any[] = await tx.$queryRaw`
          SELECT id, current_stock FROM inventory WHERE product_id = ${item.productId} FOR UPDATE
        `;

        if (!invRows || invRows.length === 0) {
          throw new AppError(`Inventory for product '${item.product.name}' not found`, 404, ERROR_CODES.NOT_FOUND);
        }

        const currentStock = Number(invRows[0].current_stock);
        if (currentStock < item.quantity) {
          throw new AppError(
            `Insufficient stock for '${item.product.name}' (${item.partNumberSnapshot}). Requested: ${item.quantity}, Available: ${currentStock}`,
            400,
            ERROR_CODES.INSUFFICIENT_STOCK
          );
        }

        // Recalculate totals server-side
        const lineSubtotal = mulMoney(item.unitPrice, item.quantity);
        const lineAfterDiscount = subMoney(lineSubtotal, item.discountAmount);
        const { gstAmount } = calculateGst(lineAfterDiscount, item.product.gstPercent);

        subtotal = Number(addMoney(subtotal, lineSubtotal));
        gstTotal = Number(addMoney(gstTotal, gstAmount));
      }

      const grandTotal = Number(subMoney(addMoney(subtotal, gstTotal), Number(saleRow.discount_amount)));

      // 6. Generate Document Numbers
      const finalizedSaleNumber = await this.getNextSequenceNumber(tx, 'SALE', 'SL');
      const invoiceNumber = await this.getNextSequenceNumber(tx, 'INVOICE', 'INV');

      // 7. Insert SALE_OUT movements & update inventory stock
      for (const item of saleItems) {
        const invRows: any[] = await tx.$queryRaw`SELECT current_stock FROM inventory WHERE product_id = ${item.productId}`;
        const stockBefore = Number(invRows[0].current_stock);
        const stockAfter = stockBefore - item.quantity;

        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            currentStock: stockAfter,
            lastMovementAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            movementType: MOVEMENT_TYPES.SALE_OUT,
            quantityChange: -item.quantity,
            stockBefore,
            stockAfter,
            referenceType: 'SALE',
            referenceId: saleId,
            remarks: `Deducted for finalized sale ${finalizedSaleNumber}`,
            createdBy: finalizedBy,
          },
        });
      }

      // 8. Insert Immutable Invoice Row
      const shopSnapshot = {
        name: 'Tractor Spare Parts ERP Store',
        address: 'Main Market Road, District Center',
        gstin: '27AAAAA0000A1Z5',
      };

      const customerSnapshot = {
        name: customer.name,
        mobile: customer.mobile,
        gstNumber: customer.gstNumber,
        address: customer.address,
      };

      const invoice = await tx.invoice.create({
        data: {
          saleId,
          invoiceNumber,
          invoiceDate: new Date(),
          status: INVOICE_STATUS.FINALIZED,
          shopSnapshot,
          customerSnapshot,
          subtotal,
          gstTotal,
          discountTotal: Number(saleRow.discount_amount),
          grandTotal,
          paidAmount: Number(saleRow.paid_amount),
          pendingAmount: Math.max(0, grandTotal - Number(saleRow.paid_amount)),
        },
      });

      // 9. Payment & Payment Allocation (if paidAmount > 0)
      let paymentRecord = null;
      if (Number(saleRow.paid_amount) > 0) {
        const paymentNumber = await this.getNextSequenceNumber(tx, 'PAYMENT', 'PAY');
        paymentRecord = await tx.payment.create({
          data: {
            paymentNumber,
            saleId,
            customerId: customer.id,
            amount: Number(saleRow.paid_amount),
            paymentMethod: 'CASH',
            status: PAYMENT_STATUS.COMPLETED,
            receivedBy: finalizedBy,
            paymentDate: new Date(),
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: paymentRecord.id,
            invoiceId: invoice.id,
            allocatedAmount: Number(saleRow.paid_amount),
          },
        });
      }

      // 10. Customer Ledger Entries (INVOICE_DEBIT & PAYMENT_CREDIT)
      const lastLedger = await tx.customerLedger.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: 'desc' },
      });

      let currentBalance = lastLedger ? Number(lastLedger.runningBalance) : Number(customer.openingBalance);

      // Post Debit Entry for Invoice
      const debitBalance = currentBalance + grandTotal;
      await tx.customerLedger.create({
        data: {
          customerId: customer.id,
          entryType: 'INVOICE_DEBIT',
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          debitAmount: grandTotal,
          creditAmount: 0,
          runningBalance: debitBalance,
          description: `Billed via Invoice ${invoiceNumber}`,
          createdBy: finalizedBy,
        },
      });
      currentBalance = debitBalance;

      // Post Credit Entry for Payment (if paid > 0)
      if (Number(saleRow.paid_amount) > 0 && paymentRecord) {
        const creditBalance = currentBalance - Number(saleRow.paid_amount);
        await tx.customerLedger.create({
          data: {
            customerId: customer.id,
            entryType: 'PAYMENT_CREDIT',
            referenceType: 'PAYMENT',
            referenceId: paymentRecord.id,
            debitAmount: 0,
            creditAmount: Number(saleRow.paid_amount),
            runningBalance: creditBalance,
            description: `Payment received via ${paymentRecord.paymentNumber}`,
            createdBy: finalizedBy,
          },
        });
      }

      // 11. Update Sale Status & Derive Payment Status
      let derivedPaymentStatus: string = PAYMENT_STATUS.PENDING;
      if (Number(saleRow.paid_amount) >= grandTotal) {
        derivedPaymentStatus = PAYMENT_STATUS.COMPLETED;
      } else if (Number(saleRow.paid_amount) > 0) {
        derivedPaymentStatus = PAYMENT_STATUS.PARTIAL;
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          saleNumber: finalizedSaleNumber,
          saleStatus: SALE_STATUS.FINALIZED,
          paymentStatus: derivedPaymentStatus,
          subtotal,
          gstTotal,
          grandTotal,
          pendingAmount: Math.max(0, grandTotal - Number(saleRow.paid_amount)),
          finalizedBy,
          finalizedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          invoice: true,
          saleItems: true,
          payments: true,
        },
      });

      // 12. Save Idempotency Key record
      if (idempotencyKey) {
        await tx.idempotencyKey.create({
          data: {
            key: idempotencyKey,
            endpoint: `/api/v1/sales/${saleId}/finalize`,
            requestHash: saleId.toString(),
            statusCode: 200,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      // 13. Audit Log Entry
      await tx.auditLog.create({
        data: {
          userId: finalizedBy,
          action: 'SALE_FINALIZED',
          module: 'SALES',
          recordId: saleId,
          newValue: { invoiceNumber, grandTotal, saleNumber: finalizedSaleNumber },
        },
      });

      return updatedSale;
    });
  }

  async cancelSaleTransaction(saleId: bigint, cancelledBy: bigint, cancelReason: string) {
    return prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { invoice: true, saleItems: true },
      });

      if (!sale || sale.saleStatus !== SALE_STATUS.FINALIZED) {
        throw new AppError('Only FINALIZED sales can be cancelled', 400, ERROR_CODES.INVALID_STATUS_TRANSITION);
      }

      // Reversal: Stock Restored (SALE_CANCEL_REVERSAL_IN)
      for (const item of sale.saleItems) {
        const invRows: any[] = await tx.$queryRaw`SELECT current_stock FROM inventory WHERE product_id = ${item.productId} FOR UPDATE`;
        const stockBefore = Number(invRows[0].current_stock);
        const stockAfter = stockBefore + item.quantity;

        await tx.inventory.update({
          where: { productId: item.productId },
          data: { currentStock: stockAfter, updatedAt: new Date() },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            movementType: MOVEMENT_TYPES.SALE_CANCEL_REVERSAL_IN,
            quantityChange: item.quantity,
            stockBefore,
            stockAfter,
            referenceType: 'SALE_CANCELLATION',
            referenceId: saleId,
            remarks: `Restored stock from cancelled sale ${sale.saleNumber}. Reason: ${cancelReason}`,
            createdBy: cancelledBy,
          },
        });
      }

      // Reversal: Ledger Reversal
      const lastLedger = await tx.customerLedger.findFirst({
        where: { customerId: sale.customerId },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = lastLedger ? Number(lastLedger.runningBalance) : 0;
      const reversedBalance = currentBalance - Number(sale.grandTotal);

      await tx.customerLedger.create({
        data: {
          customerId: sale.customerId,
          entryType: 'REVERSAL',
          referenceType: 'INVOICE',
          referenceId: sale.invoice?.id,
          debitAmount: 0,
          creditAmount: Number(sale.grandTotal),
          runningBalance: reversedBalance,
          description: `Cancelled Invoice ${sale.invoice?.invoiceNumber}. Reason: ${cancelReason}`,
          createdBy: cancelledBy,
        },
      });

      // Update Invoice & Sale
      if (sale.invoice) {
        await tx.invoice.update({
          where: { id: sale.invoice.id },
          data: { status: INVOICE_STATUS.CANCELLED, cancelledBy, cancelledAt: new Date(), cancelReason },
        });
      }

      const updatedSale = await tx.sale.update({
        where: { id: saleId },
        data: {
          saleStatus: SALE_STATUS.CANCELLED,
          paymentStatus: PAYMENT_STATUS.CANCELLED,
          cancelledBy,
          cancelledAt: new Date(),
          cancelReason,
        },
      });

      return updatedSale;
    });
  }
}

export const salesRepository = new SalesRepository();
