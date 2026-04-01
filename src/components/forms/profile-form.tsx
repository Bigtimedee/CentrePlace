"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Toggle } from "@/components/ui/toggle";
import { US_STATES, CURRENT_YEAR } from "@/lib/constants";
import { CITIES_BY_STATE } from "@/server/simulation/tax/city-income";
import { Trash2, PlusCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function ProfileForm() {
  const { data: profile, isLoading, refetch } = trpc.profile.get.useQuery();

  const upsert = trpc.profile.upsert.useMutation({ onSuccess: () => { refetch(); toast.success("Profile saved"); } });
  const addChild = trpc.profile.addChild.useMutation({ onSuccess: () => { refetch(); setShowChildForm(false); } });
  const deleteChild = trpc.profile.deleteChild.useMutation({ onSuccess: () => refetch() });

  const [form, setForm] = useState({
    filingStatus: "single" as "single" | "married_filing_jointly",
    stateOfResidence: "CA",
    cityOfResidence: null as string | null,
    birthYear: CURRENT_YEAR - 40,
    targetAge: 90,
    assumedReturnRate: 7,      // displayed as percent
    safeHarborElection: true,
    postFIReturnRate: 5,       // displayed as percent
  });

  const [showChildForm, setShowChildForm] = useState(false);
  const [childForm, setChildForm] = useState({
    name: "",
    birthYear: CURRENT_YEAR - 10,
    k12TuitionCost: 0,
    educationType: "none" as "none" | "public" | "private",
    annualEducationCost: 0,
    includesGraduateSchool: false,
    graduateSchoolCost: 0,
    graduateSchoolYears: 0,
    inheritancePct: 0,
  });

  // Hydrate form from server data
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        filingStatus: profile.filingStatus,
        stateOfResidence: profile.stateOfResidence,
        cityOfResidence: profile.cityOfResidence ?? null,
        birthYear: profile.birthYear,
        targetAge: profile.targetAge,
        assumedReturnRate: Math.round(profile.assumedReturnRate * 100 * 10) / 10,
        safeHarborElection: profile.safeHarborElection,
        postFIReturnRate: Math.round(profile.postFIReturnRate * 100 * 10) / 10,
      });
    }
  }, [profile]);

  function handleSave() {
    upsert.mutate({
      ...form,
      assumedReturnRate: form.assumedReturnRate / 100,
      postFIReturnRate: form.postFIReturnRate / 100,
    });
  }

  function handleAddChild() {
    addChild.mutate({
      ...childForm,
      inheritancePct: childForm.inheritancePct / 100,
    });
  }

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  const children = profile?.children ?? [];

  return (
    <div className="space-y-6">
      {/* Core profile */}
      <Card>
        <CardHeader title="Personal Details" description="Used for tax bracket selection and FI timeline" />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="Filing Status" required>
              <Select
                value={form.filingStatus}
                onChange={e => setForm(f => ({ ...f, filingStatus: e.target.value as typeof f.filingStatus }))}
              >
                <option value="single">Single</option>
                <option value="married_filing_jointly">Married Filing Jointly</option>
              </Select>
            </FormField>

            <FormField label="State of Residence" required>
              <Select
                value={form.stateOfResidence}
                onChange={e => setForm(f => ({ ...f, stateOfResidence: e.target.value, cityOfResidence: null }))}
              >
                {US_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </Select>
            </FormField>

            {CITIES_BY_STATE[form.stateOfResidence] && (
              <FormField label="City / Local Tax Jurisdiction" hint="Leave blank if no city income tax applies to you">
                <Select
                  value={form.cityOfResidence ?? ""}
                  onChange={e => setForm(f => ({ ...f, cityOfResidence: e.target.value || null }))}
                >
                  <option value="">None</option>
                  {CITIES_BY_STATE[form.stateOfResidence].map(city => (
                    <option key={city.code} value={city.code}>{city.name}</option>
                  ))}
                </Select>
              </FormField>
            )}

            <FormField label="Birth Year" required>
              <Input
                type="number"
                min={1940}
                max={2000}
                value={form.birthYear}
                onChange={e => setForm(f => ({ ...f, birthYear: parseInt(e.target.value) || f.birthYear }))}
              />
            </FormField>

            <FormField label="Target Age" hint="Age through which capital must sustain spending" required>
              <Input
                type="number"
                min={70}
                max={100}
                value={form.targetAge}
                onChange={e => setForm(f => ({ ...f, targetAge: parseInt(e.target.value) || f.targetAge }))}
              />
            </FormField>

            <FormField label="Assumed Portfolio Return" hint="Annual blended return rate for simulation (pre-FI)" required>
              <Input
                type="number"
                min={1}
                max={20}
                step={0.5}
                suffix="%"
                value={form.assumedReturnRate}
                onChange={e => setForm(f => ({ ...f, assumedReturnRate: parseFloat(e.target.value) || f.assumedReturnRate }))}
              />
            </FormField>

            <FormField label="Post-FI Return Rate" hint="Conservative return after FI — shift to bonds/income allocation" required>
              <Input
                type="number"
                min={1}
                max={15}
                step={0.5}
                suffix="%"
                value={form.postFIReturnRate}
                onChange={e => setForm(f => ({ ...f, postFIReturnRate: parseFloat(e.target.value) || f.postFIReturnRate }))}
              />
            </FormField>

            <FormField label="Quarterly Tax Estimates" hint="Safe harbor = pay 100% (or 110%) of prior-year tax">
              <Toggle
                checked={form.safeHarborElection}
                onChange={v => setForm(f => ({ ...f, safeHarborElection: v }))}
                label="Use safe harbor method"
              />
            </FormField>
          </div>

          <div className="mt-5 flex justify-end">
            <Button onClick={handleSave} loading={upsert.isPending}>
              {upsert.isPending ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Children */}
      <Card>
        <CardHeader
          title="Children"
          description="Used for education cost projections and estate beneficiary allocations"
          action={
            !showChildForm && (
              <Button variant="secondary" size="sm" onClick={() => setShowChildForm(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Child
              </Button>
            )
          }
        />

        {children.length > 0 && (
          <div className="divide-y divide-slate-200">
            {children.map(child => (
              <div key={child.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <span className="text-sm text-slate-700 font-medium">{child.name}</span>
                  <span className="text-xs text-slate-600 ml-3">
                    b. {child.birthYear}
                    {(child.k12TuitionCost ?? 0) > 0 && ` · K-12 ${formatCurrency(child.k12TuitionCost ?? 0, true)}/yr`}
                    {child.educationType !== "none" ? ` · ${child.educationType} college ${formatCurrency(child.annualEducationCost ?? 0, true)}/yr` : ""}
                    {" "}· {Math.round((child.inheritancePct ?? 0) * 100)}% estate
                  </span>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => deleteChild.mutate({ id: child.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {showChildForm && (
          <CardBody className="border-t border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField label="Name" required>
                <Input
                  value={childForm.name}
                  onChange={e => setChildForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="First name"
                />
              </FormField>

              <FormField label="Birth Year" required>
                <Input
                  type="number"
                  min={2000}
                  max={CURRENT_YEAR}
                  value={childForm.birthYear}
                  onChange={e => setChildForm(f => ({ ...f, birthYear: parseInt(e.target.value) || f.birthYear }))}
                />
              </FormField>

              <FormField label="K-12 Private Tuition" hint="Annual cost, ages 5–17. Leave 0 if public or not modeling.">
                <Input
                  type="number"
                  min={0}
                  prefix="$"
                  value={childForm.k12TuitionCost}
                  onChange={e => setChildForm(f => ({ ...f, k12TuitionCost: parseFloat(e.target.value) || 0 }))}
                />
              </FormField>

              <FormField label="College Type">
                <Select
                  value={childForm.educationType}
                  onChange={e => setChildForm(f => ({ ...f, educationType: e.target.value as typeof f.educationType }))}
                >
                  <option value="none">Not modeling college</option>
                  <option value="public">Public university</option>
                  <option value="private">Private university</option>
                </Select>
              </FormField>

              {childForm.educationType !== "none" && (
                <FormField label="Annual College Cost">
                  <Input
                    type="number"
                    min={0}
                    prefix="$"
                    value={childForm.annualEducationCost}
                    onChange={e => setChildForm(f => ({ ...f, annualEducationCost: parseFloat(e.target.value) || 0 }))}
                  />
                </FormField>
              )}

              <FormField label="Graduate School">
                <Toggle
                  checked={childForm.includesGraduateSchool}
                  onChange={v => setChildForm(f => ({ ...f, includesGraduateSchool: v }))}
                  label="Include grad school costs"
                />
              </FormField>

              {childForm.includesGraduateSchool && (
                <>
                  <FormField label="Annual Grad School Cost">
                    <Input
                      type="number"
                      min={0}
                      prefix="$"
                      value={childForm.graduateSchoolCost}
                      onChange={e => setChildForm(f => ({ ...f, graduateSchoolCost: parseFloat(e.target.value) || 0 }))}
                    />
                  </FormField>
                  <FormField label="Years in Grad School">
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={childForm.graduateSchoolYears}
                      onChange={e => setChildForm(f => ({ ...f, graduateSchoolYears: parseInt(e.target.value) || 0 }))}
                    />
                  </FormField>
                </>
              )}

              <FormField label="Estate Allocation" hint="% of estate directed to this child">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  suffix="%"
                  value={childForm.inheritancePct}
                  onChange={e => setChildForm(f => ({ ...f, inheritancePct: parseFloat(e.target.value) || 0 }))}
                />
              </FormField>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <Button variant="ghost" size="sm" onClick={() => setShowChildForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAddChild} disabled={!childForm.name} loading={addChild.isPending}>
                {addChild.isPending ? "Adding…" : "Add Child"}
              </Button>
            </div>
          </CardBody>
        )}

        {children.length === 0 && !showChildForm && (
          <CardBody>
            <p className="text-sm text-slate-600">No children added yet.</p>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
