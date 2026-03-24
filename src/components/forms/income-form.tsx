"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

export function IncomeForm() {
  const { data, isLoading, refetch } = trpc.income.get.useQuery();
  const upsert = trpc.income.upsert.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    annualSalary: 0,
    annualBonus: 0,
    salaryGrowthRate: 3,    // displayed as %
    bonusGrowthRate: 3,
  });

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        annualSalary: data.annualSalary,
        annualBonus: data.annualBonus,
        salaryGrowthRate: Math.round(data.salaryGrowthRate * 100 * 10) / 10,
        bonusGrowthRate: Math.round(data.bonusGrowthRate * 100 * 10) / 10,
      });
    }
  }, [data]);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  return (
    <Card>
      <CardHeader
        title="W-2 Income"
        description="Pre-FI income that reduces capital consumption until financial independence is reached"
      />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField label="Annual Base Salary" required>
            <Input
              type="number"
              min={0}
              prefix="$"
              value={form.annualSalary}
              onChange={e => setForm(f => ({ ...f, annualSalary: parseFloat(e.target.value) || 0 }))}
            />
          </FormField>

          <FormField label="Annual Bonus (target)" hint="Expected total bonus before taxes">
            <Input
              type="number"
              min={0}
              prefix="$"
              value={form.annualBonus}
              onChange={e => setForm(f => ({ ...f, annualBonus: parseFloat(e.target.value) || 0 }))}
            />
          </FormField>

          <FormField label="Salary Growth Rate" hint="Annual comp increase assumption">
            <Input
              type="number"
              min={0}
              max={20}
              step={0.5}
              suffix="%"
              value={form.salaryGrowthRate}
              onChange={e => setForm(f => ({ ...f, salaryGrowthRate: parseFloat(e.target.value) || 0 }))}
            />
          </FormField>

          <FormField label="Bonus Growth Rate" hint="Annual bonus increase assumption">
            <Input
              type="number"
              min={0}
              max={20}
              step={0.5}
              suffix="%"
              value={form.bonusGrowthRate}
              onChange={e => setForm(f => ({ ...f, bonusGrowthRate: parseFloat(e.target.value) || 0 }))}
            />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            onClick={() =>
              upsert.mutate({
                ...form,
                salaryGrowthRate: form.salaryGrowthRate / 100,
                bonusGrowthRate: form.bonusGrowthRate / 100,
              })
            }
            disabled={upsert.isPending}
          >
            {upsert.isPending ? "Saving…" : "Save Income"}
          </Button>
        </div>
        {upsert.isSuccess && <p className="text-xs text-emerald-400 text-right mt-2">Saved</p>}
      </CardBody>
    </Card>
  );
}
