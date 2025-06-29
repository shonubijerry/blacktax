"use client";

import { useState, useEffect } from "react";
import { FamilyMember, TransferRequest, blackTaxApi } from "@/lib/api";

interface TransferFormProps {
  onSubmit: (data: TransferRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

declare global {
  interface Window {
    PaystackPop: {
      new (): {
        newTransaction: (options: object) => void;
      };
    };
  }
}

export default function TransferForm({
  onSubmit: handleSubmit,
  onCancel,
  isLoading,
}: TransferFormProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [recipients, setRecipients] = useState<
    Array<{ id: string; amount: number }>
  >([{ id: "", amount: 0 }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  let bypassPayment = false

  useEffect(() => {
    loadMembers();
    loadPaystackScript();
  }, []);

  // Load Paystack script
  const loadPaystackScript = () => {
    if (typeof window === "undefined") return;

    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src="https://js.paystack.co/v2/inline.js"]'
    );
    if (existingScript) {
      setPaystackLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.onload = () => setPaystackLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Paystack script");
      setErrors({
        general: "Payment system failed to load. Please refresh the page.",
      });
    };
    document.head.appendChild(script);
  };

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await blackTaxApi.getMembers();
      setMembers(response.data);
    } catch (error) {
      console.error("Failed to load members:", error);
      setErrors({
        general: "Failed to load family members. Please try again.",
      });
    } finally {
      setLoadingMembers(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!recipients.length) {
      newErrors.recipients = "At least one recipient is required";
      setErrors(newErrors);
      return false;
    }

    const validRecipients = recipients.every((r) => r.id && r.amount >= 100);
    if (!validRecipients) {
      newErrors.recipients = "All recipients must have amount ≥ ₦100";
      setErrors(newErrors);
      return false;
    }

    // Check for duplicate recipients
    const recipientIds = recipients.map((r) => r.id).filter(Boolean);
    const uniqueIds = new Set(recipientIds);
    if (recipientIds.length !== uniqueIds.size) {
      newErrors.recipients = "Duplicate recipients are not allowed";
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const addRecipient = () => {
    setRecipients([...recipients, { id: "", amount: 0 }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const getSelectedMember = (recipientId: string): FamilyMember | undefined => {
    return members.find((member) => member.id === recipientId);
  };

  const updateRecipient = (
    index: number,
    field: "id" | "amount",
    value: string | number
  ) => {
    const updated = [...recipients];
    let amount = 0;
    if (field === "id") {
      amount = getSelectedMember(value as string)?.balance ?? 0;
    }
    updated[index] = {
      ...updated[index],
      [field]: value,
      ...(amount && { amount }),
    };
    setRecipients(updated);

    // Clear errors when user makes changes
    if (errors.recipients) {
      setErrors({ ...errors, recipients: "" });
    }
  };

  const getTotalAmount = () => {
    return recipients.reduce(
      (sum, recipient) => sum + (recipient.amount || 0),
      0
    );
  };

  // Handle successful payment
  async function handlePaymentSuccess({ reference }: { reference: string }) {
    console.log("Payment successful:", reference);
    setProcessingPayment(true);

    try {
      const transferRequest: TransferRequest = {
        recipients: recipients.filter((r) => r.id && r.amount > 0),
        reference,
      };

      await handleSubmit(transferRequest);
    } catch (error) {
      console.error("Transfer failed after payment:", error);
      setErrors({
        general:
          "Transfer failed after payment. Please contact support with reference: " +
          reference,
      });
    } finally {
      setProcessingPayment(false);
    }
  }

  // Handle payment close/cancel
  const handlePaymentClose = () => {
    console.log("Payment dialog closed");
    setProcessingPayment(false);
  };

  // Initialize Paystack payment
  const initializePayment = () => {
    if (typeof window === "undefined") return;

    if (!paystackLoaded || !window.PaystackPop) {
      setErrors({
        general:
          "Payment system is still loading. Please try again in a moment.",
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setProcessingPayment(true);
    setErrors({});

    const paystack = new window.PaystackPop();
    paystack.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "",
      email: "shonubijerry@gmail.com", // Replace with actual user email from your auth system
      amount: getTotalAmount() * 100, // Amount in kobo
      currency: "NGN",
      reference: new Date().getTime().toString(),
      metadata: {
        custom_fields: [
          {
            display_name: "recipientIds",
            variable_name: "recipients",
            value: JSON.stringify(
              recipients.filter((r) => r.id && r.amount > 100).map((r) => r.id)
            ),
          },
          {
            display_name: "totalAmount",
            variable_name: "totalAmount",
            value: getTotalAmount(),
          },
        ],
      },
      onSuccess: handlePaymentSuccess,
      onCancel: handlePaymentClose,
    });
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isValidRecipients = recipients.every((r) => r.id && r.amount > 100);

    if (!isValidRecipients) {
      setErrors({
        general: "All recipients must have minimum amount of ₦100",
      });
    }

    bypassPayment = true
    // Use this to bypass paystack
    if (bypassPayment) {
      const transferRequest: TransferRequest = {
        recipients: recipients.filter((r) => r.id && r.amount >= 100),
      };

      await handleSubmit(transferRequest);
      
      return
    }

    initializePayment();
  };

  const isFormDisabled = () => {
    return isLoading || loadingMembers || processingPayment;
  };

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-blue-600 px-8 py-6">
        <h2 className="text-2xl font-bold text-white flex items-center">
          Blacktax Transfer
        </h2>
        <p className="text-green-100 mt-2">
          Transfer funds to one or more family members instantly.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="p-8 space-y-8">
        {errors.general && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{errors.general}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payment System Status */}
        {!paystackLoaded && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="animate-spin h-5 w-5 text-yellow-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  Loading payment system...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recipients Section */}
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Recipients *
              </h3>
              <p className="text-sm text-gray-600">
                Select recipients and specify amounts to transfer
              </p>
            </div>
            {getTotalAmount() > 0 && (
              <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
                Total: ₦{getTotalAmount().toFixed(2)}
              </div>
            )}
          </div>

          {errors.recipients && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-md mb-4 flex items-center">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.recipients}
            </div>
          )}

          <div className="space-y-4">
            {recipients.map((recipient, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient {index + 1}
                    </label>
                    <div className="relative">
                      <select
                        value={recipient.id}
                        onChange={(e) =>
                          updateRecipient(index, "id", e.target.value)
                        }
                        disabled={loadingMembers || isFormDisabled()}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="">
                          {loadingMembers
                            ? "Loading members..."
                            : "Select recipient..."}
                        </option>
                        {members.map((member) => (
                          <option
                            key={member.id}
                            value={member.id}
                            disabled={
                              !!recipients.find(
                                (r, i) => r.id === member.id && i !== index
                              )
                            }
                          >
                            {member.name} ({member.email})
                          </option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        {loadingMembers ? (
                          <svg
                            className="animate-spin h-5 w-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 text-lg">₦</span>
                      </div>
                      <input
                        type="number"
                        placeholder="0.00"
                        min="100"
                        step="100"
                        value={recipient.amount || ""}
                        onChange={(e) =>
                          updateRecipient(
                            index,
                            "amount",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        disabled={isFormDisabled()}
                        className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white focus:bg-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {recipients.length > 1 && (
                    <div className="flex flex-col justify-end">
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        disabled={isFormDisabled()}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 mt-7 disabled:opacity-50"
                        title="Remove recipient"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRecipient}
            disabled={isFormDisabled()}
            className="mt-4 flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 disabled:opacity-50"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            Add Another Recipient
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={processingPayment}
            className="px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isFormDisabled() || !paystackLoaded}
            className="px-8 py-3 text-sm font-semibold text-white bg-gradient-to-r from-green-600 to-blue-600 rounded-lg hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {processingPayment ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing Payment...
              </div>
            ) : isLoading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing Transfer...
              </div>
            ) : (
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Pay ₦{getTotalAmount().toFixed(2)} & Transfer
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
