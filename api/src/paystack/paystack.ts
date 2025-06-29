import { paystackTransferRes, verifyTransactionRes } from "../types";

export async function createPaystackRecipient(member: any, env: any) {
  const response = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name: member.name,
      account_number: member.accountNumber,
      bank_code: member.bankCode,
      currency: 'NGN',
    }),
  });

  if (!response.ok) {
    const error: Error = await response.json();
    throw new Error(`Failed to create Paystack recipient: ${error.message}`);
  }

  const data: { data: { recipient_code: string } } = await response.json();
  return data.data.recipient_code;
}

export async function initiatePaystackTransfer(recipientCode: string, amount: number, reference: string, env: any) {
  const response = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      recipient: recipientCode,
      amount: Math.round(amount * 100), // Convert to kobo
      reference,
      reason: 'Family transfer',
    }),
  });

  if (!response.ok) {
    const error: Error = await response.json();
    throw new Error(`Failed to initiate transfer: ${error.message}`);
  }

  return paystackTransferRes.parse(await response.json());
}

export async function verifyPayment(reference: string, env: Env) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    }
  });

  if (!response.ok) {
    const error: Error = await response.json();
    throw new Error(`Failed to initiate transfer: ${error.message}`);
  }

  return verifyTransactionRes.parse(await response.json());
}