import { useState } from "react";
import { Transfer } from "@/lib/api";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";

interface TransferCardProps {
  transfer: Transfer;
}

const getStatusStyles = (status: string) => {
  switch (status) {
    case "SUCCESS":
      return "bg-green-100 text-green-800";
    case "PENDING":
    case "PROCESSING":
      return "bg-yellow-100 text-yellow-800";
    case "FAILED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getRecipientStatusStyles = (status: string) => {
  switch (status) {
    case "SUCCESS":
      return "bg-green-50 text-green-700 border-green-200";
    case "PENDING":
    case "PROCESSING":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "FAILED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

export default function TransferCard({ transfer }: TransferCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const hasFailedRecipients = transfer.recipients.some(
    (r) => r.status === "FAILED"
  );
  const successfulRecipients = transfer.recipients.filter(
    (r) => r.status === "SUCCESS"
  ).length;
  const pendingRecipients = transfer.recipients.filter(
    (r) => r.status === "PENDING" || r.status === "PROCESSING"
  ).length;
  const failedRecipients = transfer.recipients.filter(
    (r) => r.status === "FAILED"
  ).length;

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* Main Transfer Overview */}
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="font-semibold text-gray-900 text-lg">
                #{transfer.reference}
              </h3>
              <span
                className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusStyles(
                  transfer.status
                )}`}
              >
                {transfer.status}
              </span>
            </div>

            {transfer.description && (
              <p className="text-sm text-gray-600 mb-3">
                {transfer.description}
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Total Amount:</span>
                <p className="text-lg font-semibold text-gray-900">
                  ₦{transfer.totalAmount.toLocaleString()}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Currency:</span>
                <p className="text-gray-600">{transfer.currency}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Created:</span>
                <p className="text-gray-600">
                  {formatDate(transfer.createdAt)}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Updated:</span>
                <p className="text-gray-600">
                  {formatDate(transfer.updatedAt)}
                </p>
              </div>
            </div>

            {transfer.paystackBatchId && (
              <div className="mt-3">
                <span className="text-sm font-medium text-gray-700">
                  Paystack Batch ID:
                </span>
                <p className="text-sm text-gray-600 font-mono">
                  {transfer.paystackBatchId}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recipients Summary */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">
              Recipients: {transfer.recipients.length}
            </span>
            <div className="flex items-center gap-3 text-xs">
              {successfulRecipients > 0 && (
                <span className="text-green-600">✓ {successfulRecipients}</span>
              )}
              {pendingRecipients > 0 && (
                <span className="text-yellow-600">⏳ {pendingRecipients}</span>
              )}
              {failedRecipients > 0 && (
                <span className="text-red-600">✗ {failedRecipients}</span>
              )}
            </div>
          </div>

          {hasFailedRecipients && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
              Some transfers failed
            </span>
          )}
        </div>
      </div>

      {/* Accordion Toggle */}
      <div className="border-t">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
        >
          <span className="font-medium text-gray-900">
            {isExpanded ? "Hide Recipients" : "Show Recipients"}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDownIcon className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Collapsible Recipients Section */}
      {isExpanded && (
        <div className="border-t bg-gray-50 p-6">
          <div className="space-y-3">
            {transfer.recipients.map((recipient) => (
              <div
                key={recipient.id}
                className={`border rounded-lg p-4 bg-white ${getRecipientStatusStyles(
                  recipient.status
                )}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h5 className="font-medium text-gray-900">
                        {recipient.recipient.name}
                      </h5>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyles(
                          recipient.status
                        )}`}
                      >
                        {recipient.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {recipient.recipient.email}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">
                          Amount:
                        </span>
                        <p className="font-semibold">
                          ₦{recipient.amount.toLocaleString()}
                        </p>
                      </div>

                      {recipient.paystackReference && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Paystack Ref:
                          </span>
                          <p className="font-mono text-xs">
                            {recipient.paystackReference}
                          </p>
                        </div>
                      )}

                      {recipient.transferredAt && (
                        <div>
                          <span className="font-medium text-gray-700">
                            Transferred:
                          </span>
                          <p>{formatDate(recipient.transferredAt)}</p>
                        </div>
                      )}
                    </div>

                    {recipient.failureReason && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                        <span className="font-medium text-red-800 text-sm">
                          Failure Reason:
                        </span>
                        <p className="text-red-700 text-sm mt-1">
                          {recipient.failureReason}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
