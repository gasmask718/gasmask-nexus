import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, TrendingUp, Hammer, DollarSign } from "lucide-react";

export default function LoanCalculators() {
  const [dscrInputs, setDscrInputs] = useState({
    monthlyRent: "",
    propertyTax: "",
    insurance: "",
    hoa: "",
    loanAmount: "",
    interestRate: "",
  });

  const [arvInputs, setArvInputs] = useState({
    purchasePrice: "",
    rehabBudget: "",
    arv: "",
    ltc: "90",
  });

  const [rehabInputs, setRehabInputs] = useState({
    squareFeet: "",
    bedrooms: "",
    bathrooms: "",
    kitchenRemodel: false,
    bathroomRemodel: false,
    flooring: false,
    paint: false,
    roofing: false,
  });

  const calculateDSCR = () => {
    const rent = parseFloat(dscrInputs.monthlyRent) || 0;
    const tax = parseFloat(dscrInputs.propertyTax) || 0;
    const ins = parseFloat(dscrInputs.insurance) || 0;
    const hoa = parseFloat(dscrInputs.hoa) || 0;
    const loan = parseFloat(dscrInputs.loanAmount) || 0;
    const rate = parseFloat(dscrInputs.interestRate) || 0;

    const monthlyPayment = loan * (rate / 100 / 12);
    const pitia = monthlyPayment + tax + ins + hoa;
    const dscr = pitia > 0 ? rent / pitia : 0;

    return {
      dscr: dscr.toFixed(2),
      monthlyPayment: monthlyPayment.toFixed(2),
      pitia: pitia.toFixed(2),
      qualifies: dscr >= 1.0,
    };
  };

  const calculateARV = () => {
    const purchase = parseFloat(arvInputs.purchasePrice) || 0;
    const rehab = parseFloat(arvInputs.rehabBudget) || 0;
    const arv = parseFloat(arvInputs.arv) || 0;
    const ltc = parseFloat(arvInputs.ltc) || 0;

    const totalCost = purchase + rehab;
    const maxLoan = totalCost * (ltc / 100);
    const equity = arv - maxLoan;
    const profitPotential = arv - totalCost;

    return {
      totalCost: totalCost.toFixed(0),
      maxLoan: maxLoan.toFixed(0),
      equity: equity.toFixed(0),
      profitPotential: profitPotential.toFixed(0),
      ltv: ((maxLoan / arv) * 100).toFixed(1),
    };
  };

  const calculateRehab = () => {
    const sqft = parseFloat(rehabInputs.squareFeet) || 0;
    let total = 0;

    // Base costs per sqft
    total += sqft * 10; // Basic renovations

    if (rehabInputs.kitchenRemodel) total += 15000;
    if (rehabInputs.bathroomRemodel) total += 8000 * parseInt(rehabInputs.bathrooms || "1");
    if (rehabInputs.flooring) total += sqft * 5;
    if (rehabInputs.paint) total += sqft * 2;
    if (rehabInputs.roofing) total += 8000;

    return {
      estimated: total.toFixed(0),
      perSqft: (total / sqft).toFixed(2),
      contingency: (total * 0.15).toFixed(0),
      total: (total * 1.15).toFixed(0),
    };
  };

  const dscrResults = calculateDSCR();
  const arvResults = calculateARV();
  const rehabResults = calculateRehab();

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Loan Calculator Suite</h1>
        <p className="text-muted-foreground">
          Financial analysis tools for real estate investments
        </p>
      </div>

      <Tabs defaultValue="dscr" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dscr">DSCR Calculator</TabsTrigger>
          <TabsTrigger value="arv">ARV / Hard Money</TabsTrigger>
          <TabsTrigger value="rehab">Rehab Budget</TabsTrigger>
          <TabsTrigger value="feasibility">Offer Feasibility</TabsTrigger>
        </TabsList>

        <TabsContent value="dscr" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  DSCR Inputs
                </CardTitle>
                <CardDescription>Debt Service Coverage Ratio Calculator</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Monthly Rent</Label>
                  <Input
                    type="number"
                    placeholder="3000"
                    value={dscrInputs.monthlyRent}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, monthlyRent: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Monthly Property Tax</Label>
                  <Input
                    type="number"
                    placeholder="300"
                    value={dscrInputs.propertyTax}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, propertyTax: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Monthly Insurance</Label>
                  <Input
                    type="number"
                    placeholder="150"
                    value={dscrInputs.insurance}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, insurance: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Monthly HOA</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={dscrInputs.hoa}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, hoa: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Loan Amount</Label>
                  <Input
                    type="number"
                    placeholder="250000"
                    value={dscrInputs.loanAmount}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, loanAmount: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="7.5"
                    value={dscrInputs.interestRate}
                    onChange={(e) => setDscrInputs({ ...dscrInputs, interestRate: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DSCR Results</CardTitle>
                <CardDescription>Your debt service coverage analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-6 bg-primary/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">DSCR Ratio</div>
                  <div className={`text-5xl font-bold ${parseFloat(dscrResults.dscr) >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dscrResults.dscr}
                  </div>
                  <div className="mt-2">
                    {dscrResults.qualifies ? (
                      <span className="text-green-600 font-medium">✓ Qualifies for DSCR Loan</span>
                    ) : (
                      <span className="text-red-600 font-medium">✗ Does Not Qualify</span>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Payment (P&I)</span>
                    <span className="font-bold">${dscrResults.monthlyPayment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total PITIA</span>
                    <span className="font-bold">${dscrResults.pitia}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Rent</span>
                    <span className="font-bold">${dscrInputs.monthlyRent || "0"}</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                  <strong>Note:</strong> Most DSCR lenders require a minimum ratio of 1.0-1.25. 
                  A ratio above 1.25 typically qualifies for better rates.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="arv" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  ARV Inputs
                </CardTitle>
                <CardDescription>After Repair Value Calculator</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Purchase Price</Label>
                  <Input
                    type="number"
                    placeholder="200000"
                    value={arvInputs.purchasePrice}
                    onChange={(e) => setArvInputs({ ...arvInputs, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Rehab Budget</Label>
                  <Input
                    type="number"
                    placeholder="50000"
                    value={arvInputs.rehabBudget}
                    onChange={(e) => setArvInputs({ ...arvInputs, rehabBudget: e.target.value })}
                  />
                </div>
                <div>
                  <Label>ARV (After Repair Value)</Label>
                  <Input
                    type="number"
                    placeholder="350000"
                    value={arvInputs.arv}
                    onChange={(e) => setArvInputs({ ...arvInputs, arv: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Loan-to-Cost (%) - Lender Max</Label>
                  <Input
                    type="number"
                    placeholder="90"
                    value={arvInputs.ltc}
                    onChange={(e) => setArvInputs({ ...arvInputs, ltc: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hard Money Analysis</CardTitle>
                <CardDescription>Maximum loan and profit potential</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="font-bold">${Number(arvResults.totalCost).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-primary/10 rounded-lg">
                    <span className="text-muted-foreground">Max Loan Amount</span>
                    <span className="font-bold text-primary">${Number(arvResults.maxLoan).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Your Equity Required</span>
                    <span className="font-bold">${(Number(arvResults.totalCost) - Number(arvResults.maxLoan)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                    <span className="text-muted-foreground">Profit Potential</span>
                    <span className="font-bold text-green-600">${Number(arvResults.profitPotential).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LTV (Loan-to-Value)</span>
                    <span className="font-bold">{arvResults.ltv}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rehab" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hammer className="h-5 w-5" />
                  Rehab Inputs
                </CardTitle>
                <CardDescription>Estimate renovation costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Square Feet</Label>
                  <Input
                    type="number"
                    placeholder="1500"
                    value={rehabInputs.squareFeet}
                    onChange={(e) => setRehabInputs({ ...rehabInputs, squareFeet: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bedrooms</Label>
                  <Input
                    type="number"
                    placeholder="3"
                    value={rehabInputs.bedrooms}
                    onChange={(e) => setRehabInputs({ ...rehabInputs, bedrooms: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Bathrooms</Label>
                  <Input
                    type="number"
                    placeholder="2"
                    value={rehabInputs.bathrooms}
                    onChange={(e) => setRehabInputs({ ...rehabInputs, bathrooms: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Major Work Items</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'kitchenRemodel', label: 'Full Kitchen Remodel', cost: '$15,000' },
                      { key: 'bathroomRemodel', label: 'Bathroom Remodel (per bath)', cost: '$8,000 ea' },
                      { key: 'flooring', label: 'New Flooring Throughout', cost: '$5/sqft' },
                      { key: 'paint', label: 'Interior Paint', cost: '$2/sqft' },
                      { key: 'roofing', label: 'New Roof', cost: '$8,000' },
                    ].map(item => (
                      <label key={item.key} className="flex items-center justify-between p-2 border rounded hover:bg-muted cursor-pointer">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rehabInputs[item.key as keyof typeof rehabInputs] as boolean}
                            onChange={(e) => setRehabInputs({ ...rehabInputs, [item.key]: e.target.checked })}
                            className="rounded"
                          />
                          <span>{item.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{item.cost}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rehab Budget Estimate</CardTitle>
                <CardDescription>Estimated renovation costs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center p-6 bg-primary/10 rounded-lg">
                  <div className="text-sm text-muted-foreground mb-2">Total Estimate</div>
                  <div className="text-5xl font-bold text-primary">
                    ${Number(rehabResults.estimated).toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    ${rehabResults.perSqft}/sqft
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Renovation</span>
                    <span className="font-bold">${Number(rehabResults.estimated).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">15% Contingency</span>
                    <span className="font-bold">${Number(rehabResults.contingency).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-primary/10 rounded-lg">
                    <span className="font-medium">Total with Contingency</span>
                    <span className="font-bold text-primary">${Number(rehabResults.total).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                  <strong>Note:</strong> This is a rough estimate. Always get multiple contractor bids 
                  and add 15-20% contingency for unexpected issues.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feasibility">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Offer Feasibility Calculator
              </CardTitle>
              <CardDescription>Coming soon - Analyze if your offer makes financial sense</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center text-muted-foreground">
              This calculator will help determine if an offer is viable based on all costs, fees, and potential returns.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
