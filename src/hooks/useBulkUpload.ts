/**
 * Bulk Upload Hook
 * Handles file parsing, validation, duplicate detection, and import with audit logging
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { getSchemaByType } from "@/lib/uploadSchemas";
import {
  validateColumns,
  validateAllRows,
  ValidationResult,
  RowValidationError,
  ValidatedRow,
  DuplicateGroup,
  detectIntraFileDuplicates,
  detectDbDuplicates,
} from "@/lib/uploadValidation";

// Stage enum for deterministic state transitions
export type UploadStage =
  | "SELECT_TYPE"
  | "FILE_UPLOADED"
  | "MAPPED"
  | "VALIDATED"
  | "IMPORT_READY"
  | "CONFIRM"
  | "IMPORTING"
  | "COMPLETE"
  | "ERROR";

export interface UploadState {
  step: "select" | "upload" | "validate" | "preview" | "confirm" | "importing" | "complete" | "error";
  stage: UploadStage;
  uploadType: string | null;
  fileName: string | null;
  rawData: Record<string, any>[];
  columns: string[];
  columnMapping: Record<string, string>;
  validationResult: ValidationResult | null;
  isImportReady: boolean;
  importResult: ImportResult | null;
  isProcessing: boolean;
  error: string | null;
  // Duplicate detection
  duplicates: DuplicateGroup[];
  duplicateActions: Record<string, "append" | "skip" | "create_new" | "update" | "combine">;
  // NEW: Track rows that were auto-fixed (Iterations)
  iterations: ValidatedRow[];
}

export interface ImportResult {
  success: number;
  failed: number;
  skipped: number;
  errors: RowValidationError[];
  auditLogId: string | null;
  // Step 1.5 — fine-grained stores-table outcomes
  inserted: number;
  updated: number;
  skippedDuplicate: number;
  errored: number;
  skippedDuplicateMatches: { rowNumber: number; matchedStoreId: string }[];
}

const initialState: UploadState = {
  step: "select",
  stage: "SELECT_TYPE",
  uploadType: null,
  fileName: null,
  rawData: [],
  columns: [],
  columnMapping: {},
  validationResult: null,
  isImportReady: false,
  importResult: null,
  isProcessing: false,
  error: null,
  duplicates: [],
  duplicateActions: {},
  iterations: [],
};

export function useBulkUpload() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const setUploadType = useCallback((type: string) => {
    setState((prev) => ({
      ...prev,
      uploadType: type,
      step: "upload",
      stage: "FILE_UPLOADED",
    }));
  }, []);

  const parseFile = useCallback(
    async (file: File) => {
      setState((prev) => ({ ...prev, isProcessing: true, error: null }));

      try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          throw new Error("File is empty or has no data rows");
        }

        const columns = Object.keys(jsonData[0] as any);

        // Auto-map columns based on schema with fuzzy matching
        const schema = getSchemaByType(state.uploadType || "");
        const autoMapping: Record<string, string> = {};

        if (schema) {
          const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const alreadyMapped = new Set<string>();

          // Alias map: common CSV header variations → schema field
          const aliases: Record<string, string[]> = {
            'status': ['status', 'storestatus', 'active', 'storeactive'],
            'name': ['storename', 'store', 'location', 'locationname', 'shopname', 'businessname'],
            'contact_name': ['contactname', 'contact', 'owner', 'ownername', 'manager', 'primarycontact', 'contactperson'],
            'phone': ['phone', 'phonenumber', 'tel', 'telephone', 'storephone', 'mainphone', 'phone'],
            'gasmask_notes': ['gasmasknotes', 'gasmask', 'gasmasknote', 'gasmaskcomment'],
            'hotmama_notes': ['hotmamanotes', 'hotmama', 'hotmamanote', 'hotmamacomment'],
            'hotscolatti_notes': ['hotscolattinotes', 'hotscolatti', 'hotscolattinote', 'scolattinotes', 'scalatinotes'],
            'grabba_notes': ['grabbanotes', 'grabba', 'grabbarusnotes', 'grabbarusnote', 'grabbaruscomment'],
            'address_street': ['address', 'streetaddress', 'street', 'addr', 'storeaddress', 'fulladdress'],
            'notes': ['notes', 'generalnotes', 'comment', 'comments', 'memo'],
            'mode': ['mode', 'storemode', 'ondoor', 'instore', 'ondoorinstore', 'displaymode', 'placement', 'stickermode'],
            'last_order_date': ['lastorderdate', 'lastorder', 'lastpurchase', 'lastpurchasedate', 'recentorder',
              'mostrecentorder', 'lastbuy', 'lastbuydate', 'lastsale', 'lastsaledate'],
            'invoice_amount': ['invoiceamount', 'amount', 'total', 'invoicetotal', 'totalamount', 'price', 'cost',
              'grandtotal', 'ordertotal', 'orderamount', 'balance', 'balancedue',
              'totaldue', 'amountdue', 'charge', 'totalcharge', 'billamount', 'subtotal'],
            'invoice_payment_method': ['invoicepaymentmethod', 'paymentmethod', 'howpaid', 'method',
              'paytype', 'payby', 'paidby', 'paidvia', 'paymenttype', 'paymentmode',
              'modeofpayment', 'methodofpayment', 'cashorcredit', 'cashcheck',
              'venmo', 'zelle', 'cashapp', 'creditcard', 'cc', 'ach', 'wire', 'tender'],
            'invoice_payment_status': ['invoicepaymentstatus', 'paymentstatus', 'paid', 'paidstatus',
              'paystatus', 'ispaid', 'paidunpaid', 'paidorunpaid',
              'collected', 'settled', 'cleared', 'paymentreceived', 'outstanding', 'invoicestatus'],
            'invoice_date': ['invoicedate', 'issuedate', 'dateissued', 'dateofinvoice', 'invoicecreated',
              'billingdate', 'billdate', 'orderdate', 'transactiondate', 'saledate',
              'createddate', 'createdat', 'dateoforder', 'dateissue'],
            'owed_amount': ['owedamount', 'amountowed', 'owed', 'outstandingamount',
              'outstandingbalance', 'remainingbalance', 'remaining', 'balanceremaining',
              'unpaidamount', 'unpaidbalance', 'dueamount', 'stillowed', 'leftover'],
            'invoice_amount_paid': ['invoiceamountpaid', 'amountpaid', 'paidamount',
              'amtpaid', 'totalpaid', 'received', 'amountreceived', 'amountcollected',
              'cashreceived', 'paymentamount', 'payamt'],
            'primary_contact_name': ['primarycontactname'],
            'alt_phone': ['altphone', 'alternatephone', 'secondaryphone', 'phone2'],
            'neighborhood': ['neighborhood', 'hood', 'area'],
            'boro': ['boro', 'borough'],
            'wholesaler_name': ['wholesaler', 'wholesalername', 'distributor'],
            'company': ['company', 'companyname', 'corp', 'corporation'],
            'brand': ['brand', 'brandname'],
            'tags': ['tags', 'tag', 'labels'],
            'payment_type': ['paymenttype', 'payment', 'paymethod'],
            'sells_flowers': ['sellsflowers', 'flowers'],
            'prime_time_energy': ['primetimeenergy', 'primetime', 'energy'],
            'store_code': ['storecode', 'code', 'storenum', 'storenumber'],
            'market_code': ['marketcode', 'market'],
            'special_information': ['specialinformation', 'specialinfo', 'special'],
            'notes_overview': ['notesoverview', 'overview'],
            'starter_kit': ['starterkit', 'kit'],
            'open_date': ['opendate', 'membersince', 'since', 'datejoined'],
            'address_city': ['city', 'town'],
            'address_state': ['state', 'st', 'province'],
            'address_zip': ['zip', 'zipcode', 'postalcode', 'postal'],
            'email': ['email', 'emailaddress', 'storeemail'],
            'invoice_due_date': ['invoiceduedate', 'duedate', 'due', 'paymentdue', 'dueby', 'deadline'],
            'invoice_brand': ['invoicebrand', 'productbrand', 'brandsold'],
            'invoice_notes': ['invoicenotes', 'invoicedescription', 'invoicememo', 'paymentnotes', 'remarks'],
            'invoice_paid_at': ['invoicepaidat', 'datepaid', 'paiddate', 'paidon', 'paymentdate',
              'receiveddate', 'dateofpayment', 'datecollected'],
            'invoice_received_by': ['invoicereceivedby', 'receivedby', 'collectedby',
              'paidto', 'acceptedby', 'processedby', 'handledby', 'salesperson',
              'rep', 'salesrep', 'ambassador', 'collector', 'agent'],
          };

          columns.forEach((col) => {
            const csvNorm = norm(col);

            // 1. Exact match on field name or displayName
            for (const f of schema.fields) {
              if (alreadyMapped.has(f.field)) continue;
              if (norm(f.field) === csvNorm || norm(f.displayName) === csvNorm) {
                autoMapping[col] = f.field;
                alreadyMapped.add(f.field);
                return;
              }
            }

            // 2. Alias match
            for (const [field, aliasList] of Object.entries(aliases)) {
              if (alreadyMapped.has(field)) continue;
              if (aliasList.includes(csvNorm) && schema.fields.some(f => f.field === field)) {
                autoMapping[col] = field;
                alreadyMapped.add(field);
                return;
              }
            }

            // 3. Substring/contains match
            for (const f of schema.fields) {
              if (alreadyMapped.has(f.field)) continue;
              const fieldNorm = norm(f.field);
              const displayNorm = norm(f.displayName);
              if (csvNorm.includes(fieldNorm) || fieldNorm.includes(csvNorm) ||
                  csvNorm.includes(displayNorm) || displayNorm.includes(csvNorm)) {
                autoMapping[col] = f.field;
                alreadyMapped.add(f.field);
                return;
              }
            }
          });
        }

        setState((prev) => ({
          ...prev,
          fileName: file.name,
          rawData: jsonData as Record<string, any>[],
          columns,
          columnMapping: autoMapping,
          step: "validate",
          stage: "MAPPED",
          isProcessing: false,
          isImportReady: false, // Reset import ready state
        }));

        toast.success(`Loaded ${jsonData.length} rows from ${file.name}`);
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          error: error.message,
          step: "error",
          stage: "ERROR",
        }));
        toast.error(`Failed to parse file: ${error.message}`);
      }
    },
    [state.uploadType],
  );

  const updateColumnMapping = useCallback((excelCol: string, schemaField: string) => {
    setState((prev) => ({
      ...prev,
      columnMapping: {
        ...prev.columnMapping,
        [excelCol]: schemaField,
      },
      // Reset validation when mapping changes
      isImportReady: false,
      stage: "MAPPED",
    }));
  }, []);

  const validateData = useCallback(async () => {
    const schema = getSchemaByType(state.uploadType || "");
    if (!schema) {
      toast.error("Unknown upload type");
      return;
    }

    setState((prev) => ({ ...prev, isProcessing: true }));

    // Validate columns first
    const columnValidation = validateColumns(state.columns, schema);

    if (columnValidation.missing.length > 0) {
      // Filter out 'store_name' or 'name' from missing check as we auto-fill them now
      const criticalMissing = columnValidation.missing.filter((field) => field !== "store_name" && field !== "name");

      if (criticalMissing.length > 0) {
        toast.error(`Missing required columns: ${criticalMissing.join(", ")}`);
        setState((prev) => ({ ...prev, isProcessing: false }));
        return;
      }
    }

    // 1. Run standard validation
    const result = validateAllRows(state.rawData, schema, state.columnMapping);

    // 2. ITERATION & AUTO-FIX LOGIC
    // Scan for rows that failed ONLY due to missing name, fix them, and move them to valid.
    const iterations: ValidatedRow[] = [];

    result.rows.forEach((row) => {
      // Check if name is missing (undefined, null, or empty string)
      const hasName = row.data.name || row.data.store_name;

      if (!hasName) {
        // Auto-fill with "No Name"
        row.data.name = "No Name";
        row.data.store_name = "No Name";

        // Remove the specific error about missing name from the errors array
        row.errors = row.errors.filter((e) => e.column !== "name" && e.column !== "store_name");

        // If no other errors remain, promote the row to 'valid'
        if (row.errors.length === 0) {
          row.status = "valid";
        }

        // Track this row as an iteration (auto-fixed)
        iterations.push(row);
      }
    });

    // Recalculate summary stats after the fixes
    result.summary.validRows = result.rows.filter((r) => r.status === "valid").length;
    result.summary.errorRows = result.rows.filter((r) => r.status === "error").length;

    // 3. Detect duplicates (for store upload types)
    let allDuplicates: DuplicateGroup[] = [];
    const defaultActions: Record<string, "append" | "skip" | "create_new" | "combine"> = {};

    if (state.uploadType === "stores" || state.uploadType === "combined_crm") {
      // 1. Intra-file duplicates (same name + same address within file)
      // Note: This runs AFTER auto-fill, so multiple "No Name" at same address will be flagged
      const intraFileDups = detectIntraFileDuplicates(result.rows);

      // 2. DB duplicates (match against existing stores in store_master — canonical source)
      try {
        const { data: existingStoresMaster } = await supabase
          .from("store_master")
          .select("id, store_name, address, health_status")
          .is("deleted_at", null)
          .limit(5000);

        if (existingStoresMaster) {
          const normalizedStores = existingStoresMaster.map((s) => ({
            id: s.id,
            name: s.store_name || "No Name",
            address: s.address || "",
            status: (s.health_status as string) || "active",
          }));
          const dbDups = detectDbDuplicates(result.rows, normalizedStores);
          allDuplicates = [...intraFileDups, ...dbDups];
        } else {
          allDuplicates = intraFileDups;
        }
      } catch (e) {
        console.error("Failed to check DB duplicates:", e);
        allDuplicates = intraFileDups;
      }

      // Set default actions
      for (const dup of allDuplicates) {
        defaultActions[dup.key] = dup.existingStore ? "append" : "skip";
      }
    }

    const hasValidRows = result.summary.validRows > 0;
    const isImportReady = hasValidRows;

    setState((prev) => ({
      ...prev,
      validationResult: result,
      step: "preview",
      stage: isImportReady ? "IMPORT_READY" : "VALIDATED",
      isImportReady,
      isProcessing: false,
      duplicates: allDuplicates,
      duplicateActions: defaultActions,
      iterations: iterations, // Store auto-fixed rows
    }));

    if (allDuplicates.length > 0) {
      const dbDups = allDuplicates.filter((d) => d.existingStore);
      const fileDups = allDuplicates.filter((d) => !d.existingStore);
      const parts: string[] = [];
      if (dbDups.length > 0) parts.push(`${dbDups.length} match existing stores`);
      if (fileDups.length > 0) parts.push(`${fileDups.length} in-file duplicates`);
      toast.warning(`Duplicates found: ${parts.join(", ")}`);
    } else if (result.summary.errorRows > 0) {
      toast.warning(`${result.summary.errorRows} rows still have errors`);
    } else {
      toast.success(
        iterations.length > 0
          ? `Validation complete. ${iterations.length} rows auto-filled with "No Name".`
          : `All ${result.summary.validRows} rows validated successfully!`,
      );
    }
  }, [state.uploadType, state.columns, state.rawData, state.columnMapping]);

  const setDuplicateAction = useCallback(
    (groupKey: string, action: "append" | "skip" | "create_new" | "update" | "combine") => {
      setState((prev) => ({
        ...prev,
        duplicateActions: { ...prev.duplicateActions, [groupKey]: action },
      }));
    },
    [],
  );

  const proceedToConfirm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: "confirm",
      stage: "CONFIRM",
    }));
  }, []);

  const performImport = useCallback(
    async (mode: "append" | "upsert" = "append") => {
      if (!state.validationResult) {
        toast.error("Please validate data first");
        return;
      }

      const schema = getSchemaByType(state.uploadType || "");
      if (!schema) {
        toast.error("Unknown upload type");
        return;
      }

      setState((prev) => ({ ...prev, step: "importing", stage: "IMPORTING", isProcessing: true }));

      const result: ImportResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        auditLogId: null,
        inserted: 0,
        updated: 0,
        skippedDuplicate: 0,
        errored: 0,
        skippedDuplicateMatches: [],
      };

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { data: auditLog, error: auditError } = await supabase
          .from("admin_audit_log")
          .insert({
            actor_user_id: user?.id || "system",
            action: "bulk_import",
            target_type: state.uploadType || "unknown",
            target_id: null,
            before: null,
            after: {
              file_name: state.fileName,
              total_rows: state.validationResult.summary.totalRows,
              mode,
            },
            reason: `Bulk import from ${state.fileName}`,
          })
          .select()
          .single();

        if (!auditError && auditLog) {
          result.auditLogId = auditLog.id;
        }

        const validRows = state.validationResult.rows.filter((r) => r.status === "valid");

        const skipRows = new Set<number>();
        const appendRows = new Set<number>();
        const updateRows = new Set<number>();
        const mergedPrimaryRows = new Set<number>(); // Track merged rows to ensure they're never skipped

        // Merge data from combined duplicate rows into the surviving (first) row
        for (const dup of state.duplicates) {
          const action = state.duplicateActions[dup.key] || "skip";

          if (action === "skip") {
            dup.fileRows.forEach((r) => skipRows.add(r));
          }

          if (action === "combine") {
            // Merge all duplicate rows' data into the first row
            const primaryRowNum = dup.fileRows[0];
            const primaryRow = validRows.find((r) => r.rowNumber === primaryRowNum);

            if (primaryRow) {
              // Iterate over secondary rows and fill in any blanks in the primary
              for (let idx = 1; idx < dup.fileRows.length; idx++) {
                const secondaryRow = validRows.find((r) => r.rowNumber === dup.fileRows[idx]);
                if (secondaryRow) {
                  for (const [key, value] of Object.entries(secondaryRow.data)) {
                    // Only fill if the primary row is missing this value
                    if (
                      value !== undefined &&
                      value !== null &&
                      String(value).trim() !== "" &&
                      (!primaryRow.data[key] || String(primaryRow.data[key]).trim() === "")
                    ) {
                      primaryRow.data[key] = value;
                    }
                  }
                }
              }
            }

            // Skip all secondary rows, keep the merged primary
            dup.fileRows.slice(1).forEach((r) => skipRows.add(r));
            // Track the primary row so it's guaranteed to never be skipped
            mergedPrimaryRows.add(primaryRowNum);

            // Mark merged row for append/update
            if (dup.existingStore) {
              appendRows.add(primaryRowNum);
            } else {
              appendRows.add(primaryRowNum);
            }
          }

          if (action === "append" && dup.existingStore) {
            dup.fileRows.forEach((r) => appendRows.add(r));
          }
          if (action === "update" && dup.existingStore) {
            dup.fileRows.forEach((r) => updateRows.add(r));
          }
        }

        // CRITICAL: Remove all merged primary rows from skipRows AFTER the loop
        // This prevents a later duplicate group from re-skipping a merged row
        for (const rowNum of mergedPrimaryRows) {
          skipRows.delete(rowNum);
        }

        const filteredRows = validRows.filter((r) => !skipRows.has(r.rowNumber));

        if (state.uploadType === "stores" || state.uploadType === "combined_crm") {
          if (!user?.id) {
            throw new Error(
              "Cannot determine current user (auth.uid). Bulk upload requires an authenticated user for store provenance. Please re-authenticate and retry.",
            );
          }
          await importStores(filteredRows, mode, result, appendRows, updateRows, user.id);
        } else if (state.uploadType === "store_contacts") {
          await importStoreContacts(filteredRows, result);
        } else if (state.uploadType === "store_notes") {
          await importStoreNotes(filteredRows, result);
        } else if (state.uploadType === "invoices") {
          await importInvoices(filteredRows, result);
        }

        result.skipped = state.validationResult.summary.errorRows + skipRows.size;

        if (result.auditLogId) {
          await supabase
            .from("admin_audit_log")
            .update({
              after: {
                file_name: state.fileName,
                total_rows: state.validationResult.summary.totalRows,
                mode,
                imported: result.success,
                failed: result.failed,
                skipped: result.skipped,
              },
            })
            .eq("id", result.auditLogId);
        }

        setState((prev) => ({
          ...prev,
          importResult: result,
          step: "complete",
          stage: "COMPLETE",
          isProcessing: false,
          isImportReady: false,
        }));

        queryClient.invalidateQueries({ queryKey: ["stores"] });
        queryClient.invalidateQueries({ queryKey: ["store-contacts"] });
        queryClient.invalidateQueries({ queryKey: ["store-notes"] });
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
        queryClient.invalidateQueries({ queryKey: ["stores-with-contacts"] });

        toast.success(`Import complete: ${result.success} rows imported`);
      } catch (error: any) {
        setState((prev) => ({
          ...prev,
          error: error.message,
          step: "error",
          stage: "ERROR",
          isProcessing: false,
          isImportReady: false,
        }));
        toast.error(`Import failed: ${error.message}`);
      }
    },
    [state.validationResult, state.uploadType, state.fileName, state.duplicates, state.duplicateActions, queryClient],
  );

  return {
    state,
    reset,
    setUploadType,
    parseFile,
    updateColumnMapping,
    validateData,
    setDuplicateAction,
    proceedToConfirm,
    performImport,
  };
}

// Import functions for each type
async function importStores(
  rows: ValidatedRow[],
  mode: "append" | "upsert",
  result: ImportResult,
  appendRows: Set<number> = new Set(),
  updateRows: Set<number> = new Set(),
) {
  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          let storeType = "other";
          if (row.data.type) {
            const normalized = row.data.type.toLowerCase().trim().replace(/\s+/g, "_");
            const validTypes = ["bodega", "smoke_shop", "gas_station", "wholesaler", "other"];
            if (validTypes.includes(normalized)) {
              storeType = normalized;
            }
          }

          const storeName = row.data.name || row.data.store_name || "No Name";
          const addressStreet = row.data.address_street || row.data.address || "";
          const addressCity = row.data.address_city || row.data.city || "";
          const addressState = row.data.address_state || row.data.state || "";
          const addressZip = row.data.address_zip || row.data.zip || "";
          const phone = row.data.phone || row.data.contact_phone || null;
          const email = row.data.email || row.data.contact_email || null;
          const storeStatus = row.data.status || "active";

          // Build legacy stores data
          const storeData: any = {
            name: storeName,
            type: storeType,
            address_street: addressStreet,
            address_city: addressCity,
            address_state: addressState,
            address_zip: addressZip,
            phone,
            email,
            status: storeStatus,
            open_date: row.data.open_date || row.data.member_since,
          };

          if (row.data.primary_contact_name) storeData.primary_contact_name = row.data.primary_contact_name;
          if (row.data.alt_phone) storeData.alt_phone = row.data.alt_phone;
          if (row.data.neighborhood) storeData.neighborhood = row.data.neighborhood;
          if (row.data.boro) storeData.boro = row.data.boro;
          if (row.data.wholesaler_name) storeData.wholesaler_name = row.data.wholesaler_name;
          if (row.data.special_information) storeData.special_information = row.data.special_information;
          if (row.data.notes_overview) storeData.notes_overview = row.data.notes_overview;
          if (row.data.store_code) storeData.store_code = row.data.store_code;
          if (row.data.market_code) storeData.market_code = row.data.market_code;
          if (row.data.sells_flowers !== undefined) {
            const v = row.data.sells_flowers?.toString().toLowerCase().trim();
            storeData.sells_flowers = ["yes", "true", "1", "y", "x"].includes(v);
          }
          if (row.data.prime_time_energy !== undefined) {
            const v = row.data.prime_time_energy?.toString().toLowerCase().trim();
            storeData.prime_time_energy = ["yes", "true", "1", "y", "x"].includes(v);
          }
          if (row.data.payment_type) storeData.payment_type = row.data.payment_type;

          if (row.data.company) {
            const { data: company } = await supabase
              .from("companies")
              .select("id")
              .eq("name", row.data.company)
              .maybeSingle();

            if (company) {
              storeData.company_id = company.id;
            }
          }

          // Map status to valid health_status enum
          const statusToHealthMap: Record<string, string> = {
            'active': 'healthy',
            'healthy': 'healthy',
            'inactive': 'dormant',
            'dormant': 'dormant',
            'at_risk': 'at_risk',
            'at risk': 'at_risk',
            'lost': 'lost',
            'lead': 'healthy',
          };
          const healthStatus = statusToHealthMap[(storeStatus || '').toLowerCase().trim()] || 'healthy';

          // Build store_master data (canonical table — this is what /stores reads)
          const storeMasterData: any = {
            store_name: storeName,
            store_type: storeType,
            address: addressStreet,
            city: addressCity,
            state: addressState,
            zip: addressZip,
            phone,
            email,
            health_status: healthStatus,
            status: storeStatus || 'active',
            contact_name: row.data.contact_name || row.data.primary_contact_name || null,
            owner_name: row.data.owner_name || null,
            notes: row.data.notes || null,
            mode: row.data.mode || null,
            last_order_date: row.data.last_order_date || null,
            owed_amount: row.data.owed_amount ? parseFloat(String(row.data.owed_amount).replace(/[^0-9.-]/g, "")) || null : null,
            invoice_amount: row.data.invoice_amount ? parseFloat(String(row.data.invoice_amount).replace(/[^0-9.-]/g, "")) || null : null,
            invoice_payment_status: row.data.invoice_payment_status || null,
            invoice_payment_method: row.data.invoice_payment_method || row.data.payment_type || null,
            invoice_amount_paid: row.data.invoice_amount_paid ? parseFloat(String(row.data.invoice_amount_paid).replace(/[^0-9.-]/g, "")) || null : null,
            is_simulation: false,
          };

          // Parse last_order_date if present
          if (storeMasterData.last_order_date) {
            try {
              const parsed = new Date(String(storeMasterData.last_order_date));
              if (!isNaN(parsed.getTime())) {
                storeMasterData.last_order_date = parsed.toISOString().split("T")[0];
              } else {
                storeMasterData.last_order_date = null;
              }
            } catch { storeMasterData.last_order_date = null; }
          }

          const shouldAppend = appendRows.has(row.rowNumber);
          const shouldUpdate = updateRows.has(row.rowNumber);
          const effectiveMode = shouldAppend || shouldUpdate ? "upsert" : mode;

          // ── Write to store_master (canonical) ──
          if (effectiveMode === "upsert" || shouldAppend || shouldUpdate) {
            let smQuery = supabase.from("store_master").select("id").eq("store_name", storeName).is("deleted_at", null);
            if (addressStreet) {
              smQuery = smQuery.eq("address", addressStreet);
            }
            const { data: existingSM } = await smQuery.maybeSingle();

            if (existingSM) {
              const smUpdate = { ...storeMasterData };
              delete smUpdate.is_simulation;
              Object.keys(smUpdate).forEach((k) => {
                if (smUpdate[k] === undefined || (!shouldUpdate && (smUpdate[k] === null || smUpdate[k] === ""))) {
                  delete smUpdate[k];
                }
              });
              await supabase.from("store_master").update(smUpdate).eq("id", existingSM.id);
            } else {
              await supabase.from("store_master").insert(storeMasterData);
            }
          } else {
            // Check if already exists to avoid duplicates
            let smCheck = supabase.from("store_master").select("id").eq("store_name", storeName).is("deleted_at", null);
            if (addressStreet) smCheck = smCheck.eq("address", addressStreet);
            const { data: existingSM } = await smCheck.maybeSingle();
            if (!existingSM) {
              await supabase.from("store_master").insert(storeMasterData);
            }
          }

          // ── Also write to legacy stores table ──
          if (effectiveMode === "upsert" || shouldAppend || shouldUpdate) {
            let query = supabase.from("stores").select("id").eq("name", storeData.name);
            if (storeData.address_street) {
              query = query.eq("address_street", storeData.address_street);
            }
            const { data: existing } = await query.maybeSingle();

            if (existing) {
              const updateData = { ...storeData };
              if (shouldUpdate) {
                Object.keys(updateData).forEach((k) => {
                  if (updateData[k] === undefined) {
                    delete updateData[k];
                  }
                });
              } else {
                Object.keys(updateData).forEach((k) => {
                  if (updateData[k] === undefined || updateData[k] === null || updateData[k] === "") {
                    delete updateData[k];
                  }
                });
              }
              await supabase.from("stores").update(updateData).eq("id", existing.id);
            } else {
              await supabase.from("stores").insert(storeData);
            }
          } else {
            await supabase.from("stores").insert(storeData);
          }

          if (row.data.tags) {
            let tagsArray: string[] = [];

            if (Array.isArray(row.data.tags)) {
              tagsArray = row.data.tags;
            } else if (typeof row.data.tags === "string") {
              tagsArray = row.data.tags
                .split(/\s*\|\s*|,/)
                .map((t: string) => t.trim())
                .filter((t: string) => t.length > 0);
            }

            const { data: store } = await supabase.from("stores").select("id").eq("name", storeData.name).maybeSingle();

            for (const tag of tagsArray) {
              const slug = tag
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9-]/g, "");
              const { data: globalTag } = await supabase
                .from("global_tags")
                .upsert({ name: tag, slug, status: "active" }, { onConflict: "name" })
                .select("id")
                .single();

              if (store && globalTag) {
                await supabase.from("tag_attachments").upsert(
                  {
                    tag_id: globalTag.id,
                    entity_type: "store",
                    entity_id: store.id,
                  },
                  { onConflict: "tag_id,entity_type,entity_id", ignoreDuplicates: true },
                );
              }
            }
          }

          // Insert general notes and brand-scoped notes
          const brandNoteFields = [
            { field: 'notes', brand_scope: null },
            { field: 'gasmask_notes', brand_scope: 'gasmask' },
            { field: 'hotmama_notes', brand_scope: 'hotmama' },
             { field: 'hotscolatti_notes', brand_scope: 'hotscolatti' },
            { field: 'grabba_notes', brand_scope: 'grabba_r_us' },
          ];

          const noteInserts: { store_id: string; note_text: string; brand_scope: string | null; created_at: string }[] = [];
          for (const nf of brandNoteFields) {
            const noteText = row.data[nf.field];
            if (noteText && String(noteText).trim()) {
              noteInserts.push({
                store_id: '', // placeholder, set below
                note_text: String(noteText).trim(),
                brand_scope: nf.brand_scope,
                created_at: row.data.note_date ? new Date(row.data.note_date).toISOString() : new Date().toISOString(),
              });
            }
          }

          if (noteInserts.length > 0) {
            const { data: store } = await supabase.from("stores").select("id").eq("name", storeData.name).maybeSingle();
            if (store) {
              for (const ni of noteInserts) {
                ni.store_id = store.id;
              }
              await supabase.from("store_notes").insert(noteInserts);
            }
          }

          const hasContactData = row.data.contact_name || row.data.contact_phone;
          if (hasContactData) {
            const { data: store } = await supabase.from("stores").select("id").eq("name", storeData.name).maybeSingle();

            if (store) {
              const contactData: any = {
                store_id: store.id,
                name: row.data.contact_name || "Unknown",
                phone: row.data.contact_phone || null,
                email: row.data.contact_email || null,
                role: row.data.contact_role || "worker",
              };

              const { error: contactError } = await supabase.from("store_contacts").insert(contactData);

              if (contactError) {
                console.error("Contact insert error:", contactError);
              }
            }
          }

          const starterKitValue = row.data.starter_kit?.toString().toLowerCase().trim() || "";
          const hasStarterKitFlag = ["yes", "true", "1", "y", "x"].includes(starterKitValue);
          const storeNameForKit = storeData.name || "";
          const needsStarterKit = hasStarterKitFlag || storeNameForKit.toLowerCase().includes("starter kit");

          if (needsStarterKit) {
            const { data: store } = await supabase.from("stores").select("id").eq("name", storeData.name).maybeSingle();

            if (store) {
              const TUBE_BRANDS = [
                { id: "gasmask", name: "GasMask Bags" },
                { id: "gasmasktubes", name: "GasMask Tubes" },
                { id: "hotmama", name: "HotMama" },
                { id: "grabba", name: "Grabba R Us" },
                { id: "hotscolatti-light", name: "Hot Scolatti Light" },
                { id: "hotscolatti-dark", name: "Hot Scolatti Dark" },
              ];

              for (const brand of TUBE_BRANDS) {
                await supabase.from("store_tube_inventory_status").upsert(
                  {
                    store_id: store.id,
                    brand_id: brand.id,
                    brand_name: brand.name,
                    bring_starter_kit: true,
                    product_introduced: false,
                    owner_interested: null,
                    needs_order: false,
                    bring_samples: false,
                    has_ever_ordered: false,
                    starter_kit_delivered: false,
                  },
                  { onConflict: "store_id,brand_id" },
                );
              }
            }
          }
          // Create invoice if invoice_amount is present
          const invoiceAmount = row.data.invoice_amount;
          if (invoiceAmount && String(invoiceAmount).trim()) {
            const { data: store } = await supabase.from("stores").select("id").eq("name", storeData.name).maybeSingle();
            if (store) {
              const amountStr = String(invoiceAmount).replace(/[^0-9.-]/g, "");
              const amount = parseFloat(amountStr) || 0;
              const paymentStatus = (row.data.invoice_payment_status || "unpaid").toString().toLowerCase().trim();
              const amountPaidStr = row.data.invoice_amount_paid ? String(row.data.invoice_amount_paid).replace(/[^0-9.-]/g, "") : null;
              const amountPaid = amountPaidStr ? parseFloat(amountPaidStr) : (paymentStatus === "paid" ? amount : 0);

              let dueDate = new Date().toISOString().split("T")[0];
              if (row.data.invoice_due_date) {
                try {
                  const parsed = new Date(String(row.data.invoice_due_date));
                  if (!isNaN(parsed.getTime())) dueDate = parsed.toISOString().split("T")[0];
                } catch (e) { /* use default */ }
              }

              let createdAt: string | undefined;
              if (row.data.invoice_date) {
                try {
                  const parsed = new Date(String(row.data.invoice_date));
                  if (!isNaN(parsed.getTime())) createdAt = parsed.toISOString();
                } catch (e) { /* skip */ }
              }

              let paidAt: string | null = null;
              if (row.data.invoice_paid_at) {
                try {
                  const parsed = new Date(String(row.data.invoice_paid_at));
                  if (!isNaN(parsed.getTime())) paidAt = parsed.toISOString();
                } catch (e) { /* skip */ }
              } else if (paymentStatus === "paid") {
                paidAt = new Date().toISOString();
              }

              const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

              await supabase.from("invoices").insert({
                store_id: store.id,
                invoice_number: invoiceNumber,
                total_amount: amount,
                total: amount,
                amount_paid: amountPaid,
                due_date: dueDate,
                payment_status: paymentStatus,
                payment_method: row.data.invoice_payment_method || row.data.payment_type || null,
                notes: row.data.invoice_notes || null,
                brand: row.data.invoice_brand || row.data.brand || null,
                received_by: row.data.invoice_received_by || null,
                paid_at: paidAt,
                is_historical: true,
                entry_mode: 'backfill',
                ...(createdAt && { created_at: createdAt }),
              });

              // Also write payment details to store_master
              const { data: storeMaster } = await supabase
                .from("store_master")
                .select("id")
                .eq("store_name", storeData.name)
                .maybeSingle();

              if (storeMaster) {
                await supabase.from("store_master").update({
                  invoice_amount: amount,
                  invoice_payment_status: paymentStatus,
                  invoice_payment_method: row.data.invoice_payment_method || row.data.payment_type || null,
                  invoice_amount_paid: amountPaid,
                  invoice_due_date: dueDate,
                  invoice_date: createdAt ? createdAt.split("T")[0] : null,
                  invoice_brand: row.data.invoice_brand || row.data.brand || null,
                  invoice_notes: row.data.invoice_notes || null,
                  invoice_paid_at: paidAt,
                  invoice_received_by: row.data.invoice_received_by || null,
                }).eq("id", storeMaster.id);
              }
            }
          }

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            column: "",
            columnDisplayName: "",
            value: null,
            error: error.message,
            severity: "error",
          });
        }
      }),
    );
  }
}

async function importStoreContacts(rows: ValidatedRow[], result: ImportResult) {
  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          // Find store by name - UPDATED: Fallback to "No Name"
          const storeName = row.data.store_name || "No Name";
          const { data: store } = await supabase.from("stores").select("id").eq("name", storeName).maybeSingle();

          if (!store) {
            result.failed++;
            result.errors.push({
              row: row.rowNumber,
              column: "store_name",
              columnDisplayName: "Store Name",
              value: storeName,
              error: "Store not found",
              severity: "error",
            });
            return;
          }

          await supabase.from("store_contacts").insert({
            store_id: store.id,
            name: row.data.name,
            phone: row.data.phone,
            email: row.data.email,
            role: row.data.role || "worker",
            is_primary: row.data.is_primary || false,
            notes: row.data.notes,
          });

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            column: "",
            columnDisplayName: "",
            value: null,
            error: error.message,
            severity: "error",
          });
        }
      }),
    );
  }
}

async function importStoreNotes(rows: ValidatedRow[], result: ImportResult) {
  const { data: allStores, error: storesError } = await supabase
    .from("store_master")
    .select("id, store_name, address, phone");

  if (storesError || !allStores) {
    console.error("[Notes Import] Failed to fetch stores for matching:", storesError);
    result.failed = rows.length;
    return;
  }

  const storeByExactName: Record<string, string> = {};
  const storeByNormalizedName: Record<string, string> = {};
  const storeByPhone: Record<string, string> = {};
  const storeByAddress: Record<string, string> = {};
  const storeByAddressInName: Record<string, string> = {};

  allStores.forEach((store) => {
    if (store.store_name) {
      const exactName = store.store_name.toLowerCase().trim();
      storeByExactName[exactName] = store.id;

      const normalizedName = normalizeForMatch(store.store_name);
      storeByNormalizedName[normalizedName] = store.id;

      const addressInName = extractAddressFromName(store.store_name);
      if (addressInName) {
        storeByAddressInName[addressInName] = store.id;
      }
    }
    if (store.phone) {
      const normalizedPhone = String(store.phone).replace(/\D/g, "");
      if (normalizedPhone.length >= 7) {
        storeByPhone[normalizedPhone] = store.id;
      }
    }
    if (store.address) {
      const normalizedAddress = normalizeForMatch(store.address);
      storeByAddress[normalizedAddress] = store.id;
    }
  });

  console.log("[Notes Import] Loaded stores for matching:", {
    exactNames: Object.keys(storeByExactName).length,
    addressPatterns: Object.keys(storeByAddressInName).length,
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          // UPDATED: Default to "No Name" if missing
          const storeName = row.data.store_name?.trim() || "No Name";

          let storeId: string | null = null;
          let matchMethod = "";

          const exactStoreName = storeName.toLowerCase().trim();
          const normalizedStoreName = normalizeForMatch(storeName);
          const addressFromStoreName = extractAddressFromName(storeName);

          if (storeByExactName[exactStoreName]) {
            storeId = storeByExactName[exactStoreName];
            matchMethod = "exact_name";
          }

          if (!storeId && storeByNormalizedName[normalizedStoreName]) {
            storeId = storeByNormalizedName[normalizedStoreName];
            matchMethod = "normalized_name";
          }

          if (!storeId && addressFromStoreName && storeByAddressInName[addressFromStoreName]) {
            storeId = storeByAddressInName[addressFromStoreName];
            matchMethod = "address_in_name";
          }

          if (!storeId) {
            for (const [name, id] of Object.entries(storeByNormalizedName)) {
              const minLen = Math.min(normalizedStoreName.length, name.length);
              if (minLen >= 5) {
                if (normalizedStoreName.includes(name) || name.includes(normalizedStoreName)) {
                  storeId = id;
                  matchMethod = "partial_name";
                  break;
                }
              }
            }
          }

          if (!storeId) {
            console.log("[Notes Import] No match found for:", {
              storeName,
              exactStoreName,
              normalizedStoreName,
              addressFromStoreName,
            });
            result.skipped++;
            result.errors.push({
              row: row.rowNumber,
              column: "store_name",
              columnDisplayName: "Store Name",
              value: storeName,
              error: "No matching store found",
              severity: "warning",
            });
            return;
          }

          console.log("[Notes Import] Matched:", { storeName, storeId, matchMethod });

          let noteDate = new Date().toISOString();
          if (row.data.note_date) {
            try {
              const dateValue = row.data.note_date;
              let parsed: Date | null = null;

              const numValue = Number(dateValue);
              if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const days = Math.floor(numValue);
                const timeFraction = numValue - days;
                parsed = new Date(
                  excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000,
                );
              } else {
                const dateStr = String(dateValue).trim();
                const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                if (customMatch) {
                  const [, month, day, year, hours, minutes, seconds = "0"] = customMatch;
                  parsed = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds),
                  );
                } else {
                  parsed = new Date(dateStr);
                }
              }

              if (parsed && !isNaN(parsed.getTime())) {
                noteDate = parsed.toISOString();
              }
            } catch (e) {
              console.warn("[Notes Import] Failed to parse note_date:", row.data.note_date);
            }
          }

          const noteText = row.data.note_text?.trim() || "Contact customer for partnership details.";

          await supabase.from("store_notes").insert({
            store_id: storeId,
            note_text: noteText,
            created_at: noteDate,
          });

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            column: "",
            columnDisplayName: "",
            value: null,
            error: error.message,
            severity: "error",
          });
        }
      }),
    );
  }
}

function extractAddressFromName(name: string): string | null {
  const match = name.match(/^\s*\(([^)]+)\)/);
  return match ? match[1].toLowerCase().trim() : null;
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ").replace(/['']/g, "'").replace(/[–—]/g, "-");
}

async function importInvoices(rows: ValidatedRow[], result: ImportResult) {
  const { data: allStores, error: storesError } = await supabase
    .from("store_master")
    .select("id, store_name, address, phone");

  if (storesError || !allStores) {
    console.error("Failed to fetch stores for matching:", storesError);
    result.failed = rows.length;
    return;
  }

  const storeByExactName: Record<string, string> = {};
  const storeByNormalizedName: Record<string, string> = {};
  const storeByPhone: Record<string, string> = {};
  const storeByAddress: Record<string, string> = {};
  const storeByAddressInName: Record<string, string> = {};

  allStores.forEach((store) => {
    if (store.store_name) {
      const exactName = store.store_name.toLowerCase().trim();
      storeByExactName[exactName] = store.id;

      const normalizedName = normalizeForMatch(store.store_name);
      storeByNormalizedName[normalizedName] = store.id;

      const addressInName = extractAddressFromName(store.store_name);
      if (addressInName) {
        storeByAddressInName[addressInName] = store.id;
      }
    }
    if (store.phone) {
      const normalizedPhone = String(store.phone).replace(/\D/g, "");
      if (normalizedPhone.length >= 7) {
        storeByPhone[normalizedPhone] = store.id;
      }
    }
    if (store.address) {
      const normalizedAddress = normalizeForMatch(store.address);
      storeByAddress[normalizedAddress] = store.id;
    }
  });

  console.log("[Invoice Import] Loaded stores for matching:", {
    exactNames: Object.keys(storeByExactName).length,
    addressPatterns: Object.keys(storeByAddressInName).length,
  });

  const BATCH_SIZE = 20;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const clientName = row.data.client_name?.trim() || "";
          const clientPhone = row.data.client_phone ? String(row.data.client_phone).replace(/\D/g, "") : "";
          const clientAddress = row.data.client_address?.toLowerCase().trim() || "";

          let storeId: string | null = null;
          let matchMethod = "";

          const exactClientName = clientName.toLowerCase().trim();
          const normalizedClientName = normalizeForMatch(clientName);
          const addressFromClientName = extractAddressFromName(clientName);

          if (storeByExactName[exactClientName]) {
            storeId = storeByExactName[exactClientName];
            matchMethod = "exact_name";
          }

          if (!storeId && storeByNormalizedName[normalizedClientName]) {
            storeId = storeByNormalizedName[normalizedClientName];
            matchMethod = "normalized_name";
          }

          if (!storeId && addressFromClientName && storeByAddressInName[addressFromClientName]) {
            storeId = storeByAddressInName[addressFromClientName];
            matchMethod = "address_in_name";
          }

          if (!storeId) {
            for (const [storeName, id] of Object.entries(storeByNormalizedName)) {
              const minLen = Math.min(normalizedClientName.length, storeName.length);
              if (minLen >= 5) {
                if (normalizedClientName.includes(storeName) || storeName.includes(normalizedClientName)) {
                  storeId = id;
                  matchMethod = "partial_name";
                  break;
                }
              }
            }
          }

          if (!storeId && clientPhone.length >= 7 && storeByPhone[clientPhone]) {
            storeId = storeByPhone[clientPhone];
            matchMethod = "phone";
          }

          if (!storeId && clientAddress && storeByAddress[clientAddress]) {
            storeId = storeByAddress[clientAddress];
            matchMethod = "address";
          }

          if (!storeId) {
            console.log("[Invoice Import] No match found for:", {
              clientName,
              exactClientName,
              normalizedClientName,
              addressFromClientName,
            });
            result.skipped++;
            result.errors.push({
              row: row.rowNumber,
              column: "client_name",
              columnDisplayName: "Client Name",
              value: clientName,
              error: "No matching store found",
              severity: "warning",
            });
            return;
          }

          console.log("[Invoice Import] Matched:", { clientName, storeId, matchMethod });

          const amountStr = String(row.data.amount || "0").replace(/[^0-9.-]/g, "");
          const amount = parseFloat(amountStr) || 0;

          let dueDate = new Date().toISOString().split("T")[0];
          if (row.data.due_date) {
            try {
              const dateValue = row.data.due_date;
              let parsed: Date | null = null;

              const numValue = Number(dateValue);
              if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const days = Math.floor(numValue);
                const timeFraction = numValue - days;
                parsed = new Date(
                  excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000,
                );
              } else {
                const dateStr = String(dateValue).trim();
                const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                if (customMatch) {
                  const [, month, day, year, hours, minutes, seconds = "0"] = customMatch;
                  parsed = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds),
                  );
                } else {
                  parsed = new Date(dateStr);
                }
              }

              if (parsed && !isNaN(parsed.getTime())) {
                dueDate = parsed.toISOString().split("T")[0];
              }
            } catch (e) {
              console.warn("Failed to parse due_date:", row.data.due_date);
            }
          }

          let createdAt: string | undefined;
          if (row.data.created_at) {
            try {
              const dateValue = row.data.created_at;
              let parsed: Date | null = null;

              const numValue = Number(dateValue);
              if (!isNaN(numValue) && numValue > 25000 && numValue < 60000) {
                const excelEpoch = new Date(Date.UTC(1899, 11, 30));
                const days = Math.floor(numValue);
                const timeFraction = numValue - days;

                parsed = new Date(
                  excelEpoch.getTime() + days * 24 * 60 * 60 * 1000 + timeFraction * 24 * 60 * 60 * 1000,
                );
              } else {
                const dateStr = String(dateValue).trim();
                const customMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
                if (customMatch) {
                  const [, month, day, year, hours, minutes, seconds = "0"] = customMatch;
                  parsed = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds),
                  );
                } else {
                  parsed = new Date(dateStr);
                }
              }

              if (parsed && !isNaN(parsed.getTime())) {
                createdAt = parsed.toISOString();
              }
            } catch (e) {
              console.warn("Failed to parse created_at:", row.data.created_at);
            }
          }

          const paymentStatus = (row.data.payment_status || "unpaid").toString().toLowerCase().trim() || "unpaid";

          const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

          const { error: insertError } = await supabase.from("invoices").insert({
            store_id: storeId,
            invoice_number: invoiceNumber,
            total_amount: amount,
            total: amount,
            amount_paid: paymentStatus === "paid" ? amount : 0,
            due_date: dueDate,
            payment_status: paymentStatus,
            payment_method: row.data.payment_method || null,
            notes: row.data.notes || row.data.title || null,
            brand: row.data.brand || row.data.issued_by || null,
            created_by: row.data.issued_by || null,
            ...(createdAt && { created_at: createdAt }),
          });

          if (insertError) {
            throw insertError;
          }

          result.success++;
        } catch (error: any) {
          result.failed++;
          result.errors.push({
            row: row.rowNumber,
            column: "",
            columnDisplayName: "",
            value: null,
            error: error.message,
            severity: "error",
          });
        }
      }),
    );
  }
}
