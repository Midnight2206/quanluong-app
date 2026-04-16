import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  userFormDefaultValues,
  userFormSchema,
} from "./form-schema";

export const UserForm = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: userFormDefaultValues,
    resolver: zodResolver(userFormSchema),
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <label htmlFor="fullName">Full name</label>
        <input id="fullName" {...register("fullName")} />
        {errors.fullName ? <p>{errors.fullName.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register("email")} />
        {errors.email ? <p>{errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="role">Role</label>
        <select id="role" {...register("role")}>
          <option value="">Select a role</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
        </select>
        {errors.role ? <p>{errors.role.message}</p> : null}
      </div>

      <label>
        <input type="checkbox" {...register("isActive")} />
        Active
      </label>

      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
};
