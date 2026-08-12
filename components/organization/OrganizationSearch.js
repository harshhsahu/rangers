import SearchItems from "../UI/SearchItems";

const OrganizationSearch = ({ organizationsArray, setDisplayedOrganizations }) => {
  return (
    <>
      {organizationsArray?.length > 5 && (
        <SearchItems
          data={organizationsArray}
          setFilterItems={setDisplayedOrganizations}
          item="Workspaces"
          style="input input-sm input-bordered w-full border-stroke bg-base-200/80 text-base-content placeholder-base-content/60 focus:border-primary focus:outline-none px-4 transition-all duration-150 shadow-sm rounded-lg"
        />
      )}
    </>
  );
};

export default OrganizationSearch;
