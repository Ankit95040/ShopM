"use client";

import { useState, useCallback } from "react";
import { ReportsView } from "./ReportsView";
import { getReportData, ReportData } from "@/server/actions/report.actions";

export function ReportsViewContainer({
  initialData,
}: {
  initialData: ReportData;
}) {
  const [data, setData] = useState(initialData);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState("all");
  const [isLoading, setIsLoading] = useState(false);

  const fetchReportData = useCallback(async (month: string, customerId: string) => {
    setIsLoading(true);
    try {
      const params: { month?: string; customerId?: string } = {};
      if (month !== "all") params.month = month;
      if (customerId !== "all") params.customerId = customerId;
      const newData = await getReportData(params);
      setData(newData);
    } catch (error) {
      console.error("Failed to fetch report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleMonthChange = useCallback((month: string) => {
    setSelectedMonth(month);
    fetchReportData(month, selectedCustomerId);
  }, [selectedCustomerId, fetchReportData]);

  const handleCustomerChange = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
    fetchReportData(selectedMonth, customerId);
  }, [selectedMonth, fetchReportData]);

  return (
    <ReportsView
      periodReport={data.periodReport}
      customers={data.customers}
      transactions={data.transactions}
      availableMonths={data.availableMonths}
      selectedMonth={selectedMonth}
      selectedCustomerId={selectedCustomerId}
      onMonthChange={handleMonthChange}
      onCustomerChange={handleCustomerChange}
      isLoading={isLoading}
    />
  );
}
