// Form state for the shared project create/edit sheet. Owns the name +
// description fields and the completeness gate; the create/update mutation itself
// lives in the parent logic hook (the sheet is handed onSubmit/saving as props).
// The fields reset to the given initial values each time the sheet opens, so the
// create sheet starts blank and the edit sheet starts prefilled with the project.

import { useEffect, useState } from "react";

interface UseProjectFormSheetLogicParams {
  // Whether the sheet is open; a false→true transition reseeds the fields.
  readonly visible: boolean;
  readonly initialName: string;
  readonly initialDescription: string;
}

export function useProjectFormSheetLogic({
  visible,
  initialName,
  initialDescription,
}: UseProjectFormSheetLogicParams) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  // Reseed the fields when the sheet opens (or reopens with new initial values).
  // Typing does not re-run this: `visible` stays true and the initial values are
  // stable while the sheet is open, so the effect's deps are unchanged.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [visible, initialName, initialDescription]);

  // Completeness gate only (REACT.md): disable submit while the name is empty.
  // Description is optional, so it never blocks the submit.
  return { name, setName, description, setDescription, canSubmit: name.trim().length > 0 };
}
