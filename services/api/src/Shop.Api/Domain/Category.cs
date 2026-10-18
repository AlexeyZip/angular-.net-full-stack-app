namespace Shop.Api.Domain;

public sealed class Category
{
    // Required by EF Core for materialization.
    private Category()
    {
    }

    public Category(string name, string slug, string description)
    {
        Rename(name, slug, description);
    }

    public int Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Slug { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;

    public List<Product> Products { get; private set; } = [];

    public void Rename(string name, string slug, string description)
    {
        Name = name.Trim();
        Slug = Slugs.Normalize(slug);
        Description = description.Trim();
    }
}
